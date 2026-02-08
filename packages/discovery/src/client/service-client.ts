/**
 * Service Client
 * HTTP client with automatic service discovery and load balancing
 */

import { DiscoveryClient } from './discovery-client';
import { ServiceFilter } from '../types';
import { LeastConnectionsStrategy } from '../load-balancer/strategies';
import { DiscoveryLogger } from '../utils/logger';
import { validateServiceClientConfig } from '../utils/validation';
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

  // Non-Axios errors (e.g. "no instances available") are retryable
  return true;
}

export class ServiceClient {
  private axiosInstance: AxiosInstance;
  private retries: number;
  private retryDelay: number;

  constructor(
    private discoveryClient: DiscoveryClient,
    private config: ServiceClientConfig
  ) {
    validateServiceClientConfig(config);

    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;

    this.axiosInstance = axios.create({
      timeout: config.timeout || 5000,
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
   * Generic request with service discovery
   */
  private async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const logger = DiscoveryLogger.getLogger();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      // Discover service instance
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
      } catch (error) {
        lastError = error as Error;

        logger.warn(
          `Request to ${this.config.serviceName} failed (attempt ${attempt + 1}/${this.retries})`,
          error
        );

        // Only retry on transient / network errors
        if (!isRetryableError(error)) {
          throw error;
        }

        // Wait before retry (skip delay on last attempt since we'll throw)
        if (attempt < this.retries - 1) {
          await this.sleep(this.retryDelay);
        }
      } finally {
        if (isLeastConn) {
          (lbStrategy as LeastConnectionsStrategy).decrementConnections(instance.id);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
