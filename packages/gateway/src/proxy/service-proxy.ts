/**
 * Service Proxy
 * Enhanced HTTP client that integrates discovery, resilience, and traffic policies.
 * The core request engine of the gateway.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DiscoveryClient, ServiceInstance, ServiceFilter } from '@hazeljs/discovery';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  RetryPolicy,
  Timeout,
  RateLimiter,
  RateLimitError,
  MetricsCollector,
  CircuitBreakerConfig,
  RetryConfig,
  RateLimiterConfig,
} from '@hazeljs/resilience';
import { ProxyRequest, ProxyResponse, TrafficTransformConfig } from '../types';

export interface ServiceProxyConfig {
  /** Service name in the discovery registry */
  serviceName: string;
  /** Load balancing strategy */
  loadBalancingStrategy?: string;
  /** Service instance filter */
  filter?: ServiceFilter;
  /** Strip this prefix from the path before forwarding */
  stripPrefix?: string;
  /** Add this prefix to the path when forwarding */
  addPrefix?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Rate limiter configuration */
  rateLimit?: Partial<RateLimiterConfig>;
  /** Request/response transformers */
  transform?: TrafficTransformConfig;
}

export class ServiceProxy {
  private discoveryClient: DiscoveryClient;
  private axiosInstance: AxiosInstance;
  private retryPolicy?: RetryPolicy;
  private circuitBreaker?: CircuitBreaker;
  private timeout?: Timeout;
  private rateLimiter?: RateLimiter;
  private metrics: MetricsCollector;
  private config: ServiceProxyConfig;

  constructor(discoveryClient: DiscoveryClient, config: ServiceProxyConfig) {
    this.discoveryClient = discoveryClient;
    this.config = config;

    this.axiosInstance = axios.create({
      timeout: config.timeout ?? 10_000,
    });

    this.metrics = new MetricsCollector(60_000);

    // Initialize resilience components
    if (config.retry) {
      this.retryPolicy = new RetryPolicy(config.retry);
    }

    if (config.circuitBreaker) {
      const breakerName = `gateway:${config.serviceName}`;
      this.circuitBreaker = CircuitBreakerRegistry.getOrCreate(breakerName, config.circuitBreaker);
    }

    if (config.timeout) {
      this.timeout = new Timeout(config.timeout);
    }

    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit as RateLimiterConfig);
    }
  }

  /**
   * Forward an incoming request to the target service
   */
  async forward(request: ProxyRequest): Promise<ProxyResponse> {
    // Apply rate limiting — reject with 429 when limit exceeded
    if (this.rateLimiter) {
      if (!this.rateLimiter.tryAcquire()) {
        const retryAfterMs = this.rateLimiter.getRetryAfterMs();
        throw new RateLimitError(
          `Rate limit exceeded for ${this.config.serviceName}. Retry after ${retryAfterMs}ms`,
          retryAfterMs
        );
      }
    }

    // Apply request transformation
    let transformedRequest = request;
    if (this.config.transform?.request) {
      transformedRequest = this.config.transform.request(request);
    }

    // Build the execution function
    const executeFn = async (): Promise<ProxyResponse> => {
      return this.doForward(transformedRequest);
    };

    // Wrap with resilience layers
    let wrappedFn = executeFn;

    // Retry wraps the inner call
    if (this.retryPolicy) {
      const retryPolicy = this.retryPolicy;
      const innerFn = wrappedFn;
      wrappedFn = (): Promise<ProxyResponse> => retryPolicy.execute(innerFn);
    }

    // Circuit breaker wraps retry
    if (this.circuitBreaker) {
      const breaker = this.circuitBreaker;
      const innerFn = wrappedFn;
      wrappedFn = (): Promise<ProxyResponse> => breaker.execute(innerFn);
    }

    // Timeout wraps circuit breaker
    if (this.timeout) {
      const timeout = this.timeout;
      const innerFn = wrappedFn;
      wrappedFn = (): Promise<ProxyResponse> => timeout.execute(innerFn);
    }

    const startTime = Date.now();
    try {
      const response = await wrappedFn();
      this.metrics.recordSuccess(Date.now() - startTime);

      // Apply response transformation
      if (this.config.transform?.response) {
        return this.config.transform.response(response);
      }

      return response;
    } catch (error) {
      this.metrics.recordFailure(Date.now() - startTime, String(error));
      throw error;
    }
  }

  /**
   * Forward a request with a specific version filter
   */
  async forwardToVersion(
    request: ProxyRequest,
    version: string,
    additionalFilter?: ServiceFilter
  ): Promise<ProxyResponse> {
    const filter: ServiceFilter = {
      ...this.config.filter,
      ...additionalFilter,
      metadata: {
        ...this.config.filter?.metadata,
        ...additionalFilter?.metadata,
        version,
      },
    };

    return this.forwardWithFilter(request, filter);
  }

  /**
   * Forward with a custom filter override
   */
  async forwardWithFilter(request: ProxyRequest, filter: ServiceFilter): Promise<ProxyResponse> {
    const instance = await this.discoveryClient.getInstance(
      this.config.serviceName,
      this.config.loadBalancingStrategy,
      filter
    );

    if (!instance) {
      throw new Error(`No instances available for service: ${this.config.serviceName} with filter`);
    }

    return this.doForwardToInstance(request, instance);
  }

  /**
   * Get the metrics collector for this proxy
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Get the circuit breaker instance (if configured)
   */
  getCircuitBreaker(): CircuitBreaker | undefined {
    return this.circuitBreaker;
  }

  /**
   * Get the service name this proxy routes to
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  // ─── Internal ───

  private async doForward(request: ProxyRequest): Promise<ProxyResponse> {
    const instance = await this.discoveryClient.getInstance(
      this.config.serviceName,
      this.config.loadBalancingStrategy,
      this.config.filter
    );

    if (!instance) {
      throw new Error(`No instances available for service: ${this.config.serviceName}`);
    }

    return this.doForwardToInstance(request, instance);
  }

  private async doForwardToInstance(
    request: ProxyRequest,
    instance: ServiceInstance
  ): Promise<ProxyResponse> {
    // Build the target path
    let targetPath = request.path;
    if (this.config.stripPrefix && targetPath.startsWith(this.config.stripPrefix)) {
      targetPath = targetPath.slice(this.config.stripPrefix.length) || '/';
    }
    if (this.config.addPrefix) {
      targetPath = this.config.addPrefix + targetPath;
    }
    // Normalize: remove trailing slash so "/users/" becomes "/users".
    // This avoids 404s when the backend registers routes without a trailing slash.
    if (targetPath.length > 1 && targetPath.endsWith('/')) {
      targetPath = targetPath.slice(0, -1);
    }

    const baseURL = `${instance.protocol || 'http'}://${instance.host}:${instance.port}`;

    // Strip hop-by-hop headers that are specific to the client↔gateway connection.
    // These must NOT be forwarded to the upstream service because:
    //   - content-length: the body is re-serialized by axios, so the original
    //     content-length would be wrong and the upstream would hang waiting for
    //     exactly that many bytes.
    //   - transfer-encoding: same issue — axios chooses its own encoding.
    //   - connection / keep-alive: per-hop, not end-to-end.
    const HOP_BY_HOP = new Set([
      'content-length',
      'transfer-encoding',
      'connection',
      'keep-alive',
      'upgrade',
      'expect',
      'host',
      'te',
      'trailer',
    ]);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (value !== undefined && !HOP_BY_HOP.has(key.toLowerCase())) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }
    headers['host'] = `${instance.host}:${instance.port}`;

    const axiosConfig: AxiosRequestConfig = {
      method: request.method as AxiosRequestConfig['method'],
      url: targetPath,
      baseURL,
      headers,
      data: request.body,
      params: request.query,
    };

    try {
      const response: AxiosResponse = await this.axiosInstance.request(axiosConfig);
      return {
        status: response.status,
        headers: response.headers as Record<string, string>,
        body: response.data,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        return {
          status: error.response.status,
          headers: error.response.headers as Record<string, string>,
          body: error.response.data,
        };
      }
      throw error;
    }
  }
}
