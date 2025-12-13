/**
 * Service Client
 * HTTP client with automatic service discovery and load balancing
 */

import { DiscoveryClient } from './discovery-client';
import { ServiceFilter } from '../types';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ServiceClientConfig {
  serviceName: string;
  loadBalancingStrategy?: string;
  filter?: ServiceFilter;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class ServiceClient {
  private axiosInstance: AxiosInstance;
  private retries: number;
  private retryDelay: number;

  constructor(
    private discoveryClient: DiscoveryClient,
    private config: ServiceClientConfig
  ) {
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 1000;

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
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        // Discover service instance
        const instance = await this.discoveryClient.getInstance(
          this.config.serviceName,
          this.config.loadBalancingStrategy,
          this.config.filter
        );

        if (!instance) {
          throw new Error(`No instances available for service: ${this.config.serviceName}`);
        }

        // Build full URL
        const baseURL = `${instance.protocol}://${instance.host}:${instance.port}`;
        const fullConfig = {
          ...config,
          baseURL,
        };

        // Make request
        return await this.axiosInstance.request<T>(fullConfig);
      } catch (error) {
        lastError = error as Error;
        // Log error only in development
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error(`Request failed (attempt ${attempt + 1}/${this.retries}):`, error);
        }

        // Wait before retry
        if (attempt < this.retries - 1) {
          await this.sleep(this.retryDelay);
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
