/**
 * Service Client
 * HTTP client with automatic service discovery and load balancing.
 * Uses @hazeljs/resilience RetryPolicy for retry logic.
 */

import { DiscoveryClient } from './discovery-client';
import { ServiceFilter } from '../types';
import { LeastConnectionsStrategy } from '../load-balancer/strategies';
import { DiscoveryLogger } from '../utils/logger';
import { validateServiceClientConfig } from '../utils/validation';
import { RetryPolicy } from '@hazeljs/resilience';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export interface ServiceClientConfig {
  serviceName: string;
  loadBalancingStrategy?: string;
  filter?: ServiceFilter;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/** HTTP status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504, 408, 429]);

/**
 * Determine whether an error is transient and worth retrying.
 * Client errors (4xx except 408/429) are NOT retried.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // Network / timeout errors are always retryable
    if (!error.response) return true;

    return RETRYABLE_STATUS_CODES.has(error.response.status);
  }

  // "No instances available" is not transient - do not retry
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('No instances available')) return false;

  // Other non-Axios errors (e.g. network) are retryable
  return true;
}

export class ServiceClient {
  private axiosInstance: AxiosInstance;
  private retryPolicy: RetryPolicy;

  constructor(
    private discoveryClient: DiscoveryClient,
    private config: ServiceClientConfig
  ) {
    validateServiceClientConfig(config);

    this.axiosInstance = axios.create({
      timeout: config.timeout || 5000,
    });

    // Delegate retry logic to @hazeljs/resilience RetryPolicy
    const logger = DiscoveryLogger.getLogger();
    this.retryPolicy = new RetryPolicy({
      maxAttempts: config.retries ?? 3,
      backoff: 'fixed',
      baseDelay: config.retryDelay ?? 1000,
      jitter: false,
      retryPredicate: isRetryableError,
      onRetry: (error: unknown, attempt: number): void => {
        logger.warn(
          `Request to ${config.serviceName} failed (attempt ${attempt}/${config.retries ?? 3})`,
          error
        );
      },
    });
  }

  /**
   * GET request
   */
  async get<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url: path });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url: path, data });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url: path, data });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url: path });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url: path, data });
  }

  /**
   * Generic request with service discovery and resilience-backed retry
   */
  private async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryPolicy.execute(async () => {
      // Discover service instance on each attempt (may pick a different one)
      const instance = await this.discoveryClient.getInstance(
        this.config.serviceName,
        this.config.loadBalancingStrategy,
        this.config.filter
      );

      if (!instance) {
        throw new Error(`No instances available for service: ${this.config.serviceName}`);
      }

      // Track active connections for least-connections strategy
      const lbStrategy = this.discoveryClient
        .getLoadBalancerFactory()
        .get(this.config.loadBalancingStrategy || 'round-robin');
      const isLeastConn = lbStrategy instanceof LeastConnectionsStrategy;

      if (isLeastConn) {
        (lbStrategy as LeastConnectionsStrategy).incrementConnections(instance.id);
      }

      try {
        // Build full URL
        const baseURL = `${instance.protocol}://${instance.host}:${instance.port}`;
        const fullConfig = {
          ...config,
          baseURL,
        };

        // Make request
        const response = await this.axiosInstance.request<T>(fullConfig);
        return response;
      } finally {
        if (isLeastConn) {
          (lbStrategy as LeastConnectionsStrategy).decrementConnections(instance.id);
        }
      }
    });
  }
}
