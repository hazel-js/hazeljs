/**
 * Discovery Client
 * Discovers and retrieves service instances
 */

import { ServiceInstance, DiscoveryClientConfig, ServiceFilter } from '../types';
import { RegistryBackend } from '../backends/registry-backend';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { LoadBalancerFactory } from '../load-balancer/strategies';
import { applyServiceFilter } from '../utils/filter';
import { DiscoveryLogger } from '../utils/logger';
import { validateDiscoveryClientConfig } from '../utils/validation';

export class DiscoveryClient {
  private backend: RegistryBackend;
  private cache = new Map<string, { instances: ServiceInstance[]; timestamp: number }>();
  private loadBalancerFactory: LoadBalancerFactory;
  private refreshIntervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private config: DiscoveryClientConfig = {},
    backend?: RegistryBackend
  ) {
    validateDiscoveryClientConfig(config);

    this.backend = backend || new MemoryRegistryBackend();
    this.loadBalancerFactory = new LoadBalancerFactory();

    if (config.refreshInterval) {
      this.startRefreshInterval();
    }
  }

  /**
   * Get all instances of a service
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(serviceName);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        const ttl = this.config.cacheTTL || 30000;
        if (age < ttl) {
          return applyServiceFilter(cached.instances, filter);
        }
      }
    }

    // Fetch from backend
    const instances = await this.backend.getInstances(serviceName, filter);

    // Update cache
    if (this.config.cacheEnabled) {
      this.cache.set(serviceName, {
        instances,
        timestamp: Date.now(),
      });
    }

    return instances;
  }

  /**
   * Get a single instance using load balancing
   */
  async getInstance(
    serviceName: string,
    strategy: string = 'round-robin',
    filter?: ServiceFilter
  ): Promise<ServiceInstance | null> {
    const instances = await this.getInstances(serviceName, filter);
    if (instances.length === 0) return null;

    const loadBalancer = this.loadBalancerFactory.create(strategy);
    return loadBalancer.choose(instances);
  }

  /**
   * Get all registered service names
   */
  async getAllServices(): Promise<string[]> {
    return this.backend.getAllServices();
  }

  /**
   * Clear cache for a specific service or all services
   */
  clearCache(serviceName?: string): void {
    if (serviceName) {
      this.cache.delete(serviceName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get the backend
   */
  getBackend(): RegistryBackend {
    return this.backend;
  }

  /**
   * Get load balancer factory
   */
  getLoadBalancerFactory(): LoadBalancerFactory {
    return this.loadBalancerFactory;
  }

  /**
   * Close the discovery client and release all resources.
   * Stops the cache refresh interval and clears the cache.
   */
  close(): void {
    if (this.refreshIntervalHandle) {
      clearInterval(this.refreshIntervalHandle);
      this.refreshIntervalHandle = null;
    }
    this.cache.clear();
  }

  /**
   * Start cache refresh interval
   */
  private startRefreshInterval(): void {
    const logger = DiscoveryLogger.getLogger();

    this.refreshIntervalHandle = setInterval(async () => {
      try {
        const services = await this.getAllServices();
        for (const service of services) {
          const instances = await this.backend.getInstances(service);
          this.cache.set(service, {
            instances,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        logger.error('Failed to refresh service cache', error);
      }
    }, this.config.refreshInterval);
  }
}
