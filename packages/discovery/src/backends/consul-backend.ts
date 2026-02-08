/**
 * Consul Registry Backend
 * Integrates with HashiCorp Consul for service discovery
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';
import { applyServiceFilter } from '../utils/filter';
import { DiscoveryLogger } from '../utils/logger';
import { validateConsulBackendConfig } from '../utils/validation';

/**
 * Minimal type definitions for the Consul client API surface we use.
 * These mirror the shapes exposed by the `consul` npm package.
 */
export interface ConsulClient {
  agent: {
    service: {
      register(opts: Record<string, unknown>): Promise<void>;
      deregister(serviceId: string): Promise<void>;
      list(): Promise<Record<string, ConsulServiceEntry>>;
    };
    check: {
      pass(checkId: string): Promise<void>;
      fail(checkId: string): Promise<void>;
      warn(checkId: string): Promise<void>;
      list(): Promise<Record<string, ConsulCheckEntry>>;
    };
  };
  health: {
    service(opts: { service: string; passing?: boolean }): Promise<ConsulHealthEntry[]>;
  };
  catalog: {
    service: {
      list(): Promise<Record<string, string[]>>;
    };
  };
}

export interface ConsulServiceEntry {
  ID: string;
  Service: string;
  Address: string;
  Port: number;
  Meta?: Record<string, string>;
  Tags?: string[];
}

export interface ConsulCheckEntry {
  Status: string;
}

export interface ConsulHealthEntry {
  Service: ConsulServiceEntry;
  Checks?: ConsulCheckEntry[];
}

export interface ConsulBackendConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  token?: string;
  datacenter?: string;
  ttl?: string; // e.g., "30s", "1m"
}

export class ConsulRegistryBackend implements RegistryBackend {
  private consul: ConsulClient;
  private readonly ttl: string;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(consul: ConsulClient, config: ConsulBackendConfig = {}) {
    validateConsulBackendConfig(config);

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
    const logger = DiscoveryLogger.getLogger();
    const checkId = `service:${instanceId}`;

    try {
      // Pass TTL check
      await this.consul.agent.check.pass(checkId);
    } catch (error) {
      logger.warn(`Consul heartbeat failed for ${instanceId}, will retry on next heartbeat`, error);
    }
  }

  /**
   * Get all instances of a service
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    const logger = DiscoveryLogger.getLogger();

    try {
      const result = await this.consul.health.service({
        service: serviceName,
        passing: filter?.status === ServiceStatus.UP,
      });

      const instances: ServiceInstance[] = result.map((entry: ConsulHealthEntry) => {
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
      return applyServiceFilter(instances, filter);
    } catch (error) {
      logger.error(`Failed to get instances for service "${serviceName}" from Consul`, error);
      return [];
    }
  }

  /**
   * Get a specific service instance
   */
  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    const logger = DiscoveryLogger.getLogger();

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
        registeredAt: service.Meta?.registeredAt ? new Date(service.Meta.registeredAt) : new Date(),
      };
    } catch (error) {
      logger.error(`Failed to get instance "${instanceId}" from Consul`, error);
      return null;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<string[]> {
    const logger = DiscoveryLogger.getLogger();

    try {
      const services = await this.consul.catalog.service.list();
      return Object.keys(services);
    } catch (error) {
      logger.error('Failed to list services from Consul', error);
      return [];
    }
  }

  /**
   * Update service instance status
   */
  async updateStatus(instanceId: string, status: string): Promise<void> {
    const logger = DiscoveryLogger.getLogger();
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
      logger.warn(`Failed to update status for ${instanceId} in Consul`, error);
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
    const logger = DiscoveryLogger.getLogger();

    // Parse TTL to get interval (update at 2/3 of TTL)
    const ttlSeconds = this.parseTTL(this.ttl);
    const intervalMs = (ttlSeconds * 1000 * 2) / 3;

    const interval = setInterval(async () => {
      try {
        await this.consul.agent.check.pass(checkId);
      } catch (error) {
        logger.warn(`TTL check pass failed for ${instanceId}`, error);
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
}
