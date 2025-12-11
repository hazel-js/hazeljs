/**
 * Consul Registry Backend
 * Integrates with HashiCorp Consul for service discovery
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';

// Type definition for Consul (optional peer dependency)
type Consul = any;

export interface ConsulBackendConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  token?: string;
  datacenter?: string;
  ttl?: string; // e.g., "30s", "1m"
}

export class ConsulRegistryBackend implements RegistryBackend {
  private consul: Consul;
  private readonly ttl: string;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(consul: Consul, config: ConsulBackendConfig = {}) {
    this.consul = consul;
    this.ttl = config.ttl || '30s';
  }

  /**
   * Register a service instance with Consul
   */
  async register(instance: ServiceInstance): Promise<void> {
    const serviceId = instance.id;
    const checkId = `service:${serviceId}`;

    // Register service
    await this.consul.agent.service.register({
      id: serviceId,
      name: instance.name,
      address: instance.host,
      port: instance.port,
      tags: instance.tags || [],
      meta: {
        ...instance.metadata,
        zone: instance.zone || '',
        registeredAt: instance.registeredAt.toISOString(),
      },
      check: {
        ttl: this.ttl,
        deregister_critical_service_after: '90s',
      },
    });

    // Start TTL check updates
    this.startTTLCheck(serviceId, checkId);
  }

  /**
   * Deregister a service instance
   */
  async deregister(instanceId: string): Promise<void> {
    // Stop TTL check
    this.stopTTLCheck(instanceId);

    // Deregister from Consul
    await this.consul.agent.service.deregister(instanceId);
  }

  /**
   * Update service instance heartbeat
   */
  async heartbeat(instanceId: string): Promise<void> {
    const checkId = `service:${instanceId}`;

    try {
      // Pass TTL check
      await this.consul.agent.check.pass(checkId);
    } catch (error) {
      console.error(`Failed to update heartbeat for ${instanceId}:`, error);
    }
  }

  /**
   * Get all instances of a service
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    try {
      const result = await this.consul.health.service({
        service: serviceName,
        passing: filter?.status === ServiceStatus.UP,
      });

      const instances: ServiceInstance[] = result.map((entry: any) => {
        const service = entry.Service;
        const checks = entry.Checks || [];

        // Determine status from checks
        let status = ServiceStatus.UP;
        for (const check of checks) {
          if (check.Status === 'critical') {
            status = ServiceStatus.DOWN;
            break;
          } else if (check.Status === 'warning') {
            status = ServiceStatus.STARTING;
          }
        }

        return {
          id: service.ID,
          name: service.Service,
          host: service.Address,
          port: service.Port,
          status,
          metadata: service.Meta || {},
          tags: service.Tags || [],
          zone: service.Meta?.zone || undefined,
          lastHeartbeat: new Date(),
          registeredAt: service.Meta?.registeredAt
            ? new Date(service.Meta.registeredAt)
            : new Date(),
        };
      });

      // Apply additional filters
      if (filter) {
        return this.applyFilter(instances, filter);
      }

      return instances;
    } catch (error) {
      console.error(`Failed to get instances for ${serviceName}:`, error);
      return [];
    }
  }

  /**
   * Get a specific service instance
   */
  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    try {
      const services = await this.consul.agent.service.list();
      const service = services[instanceId];

      if (!service) {
        return null;
      }

      // Get health status
      const checks = await this.consul.agent.check.list();
      const checkId = `service:${instanceId}`;
      const check = checks[checkId];

      let status = ServiceStatus.UP;
      if (check) {
        if (check.Status === 'critical') {
          status = ServiceStatus.DOWN;
        } else if (check.Status === 'warning') {
          status = ServiceStatus.STARTING;
        }
      }

      return {
        id: service.ID,
        name: service.Service,
        host: service.Address,
        port: service.Port,
        status,
        metadata: service.Meta || {},
        tags: service.Tags || [],
        zone: service.Meta?.zone || undefined,
        lastHeartbeat: new Date(),
        registeredAt: service.Meta?.registeredAt
          ? new Date(service.Meta.registeredAt)
          : new Date(),
      };
    } catch (error) {
      console.error(`Failed to get instance ${instanceId}:`, error);
      return null;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<string[]> {
    try {
      const services = await this.consul.catalog.service.list();
      return Object.keys(services);
    } catch (error) {
      console.error('Failed to get all services:', error);
      return [];
    }
  }

  /**
   * Update service instance status
   */
  async updateStatus(instanceId: string, status: string): Promise<void> {
    const checkId = `service:${instanceId}`;

    try {
      if (status === ServiceStatus.UP) {
        await this.consul.agent.check.pass(checkId);
      } else if (status === ServiceStatus.DOWN) {
        await this.consul.agent.check.fail(checkId);
      } else if (status === ServiceStatus.STARTING) {
        await this.consul.agent.check.warn(checkId);
      }
    } catch (error) {
      console.error(`Failed to update status for ${instanceId}:`, error);
    }
  }

  /**
   * Clean up expired instances
   * Consul handles this automatically via TTL checks
   */
  async cleanup(): Promise<void> {
    // Consul automatically deregisters services that fail TTL checks
    // No manual cleanup needed
  }

  /**
   * Close Consul connection and stop all TTL checks
   */
  async close(): Promise<void> {
    // Stop all TTL check intervals
    for (const [instanceId] of this.checkIntervals) {
      this.stopTTLCheck(instanceId);
    }
  }

  /**
   * Start TTL check updates for a service
   */
  private startTTLCheck(instanceId: string, checkId: string): void {
    // Parse TTL to get interval (update at 2/3 of TTL)
    const ttlSeconds = this.parseTTL(this.ttl);
    const intervalMs = (ttlSeconds * 1000 * 2) / 3;

    const interval = setInterval(async () => {
      try {
        await this.consul.agent.check.pass(checkId);
      } catch (error) {
        console.error(`Failed to pass TTL check for ${instanceId}:`, error);
      }
    }, intervalMs);

    this.checkIntervals.set(instanceId, interval);
  }

  /**
   * Stop TTL check updates for a service
   */
  private stopTTLCheck(instanceId: string): void {
    const interval = this.checkIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(instanceId);
    }
  }

  /**
   * Parse TTL string to seconds
   */
  private parseTTL(ttl: string): number {
    const match = ttl.match(/^(\d+)([smh])$/);
    if (!match) {
      return 30; // default 30 seconds
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      default:
        return 30;
    }
  }

  /**
   * Apply filter to instances
   */
  private applyFilter(instances: ServiceInstance[], filter: ServiceFilter): ServiceInstance[] {
    return instances.filter((instance) => {
      if (filter.zone && instance.zone !== filter.zone) {
        return false;
      }

      if (filter.status && instance.status !== filter.status) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        if (!instance.tags || !filter.tags.every((tag) => instance.tags!.includes(tag))) {
          return false;
        }
      }

      if (filter.metadata) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (!instance.metadata || instance.metadata[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }
}
