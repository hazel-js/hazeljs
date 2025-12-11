/**
 * Redis Registry Backend
 * For production distributed service registry
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';
import type { Redis } from 'ioredis';

export interface RedisBackendConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Time-to-live in seconds
}

export class RedisRegistryBackend implements RegistryBackend {
  private redis: Redis;
  private readonly keyPrefix: string;
  private readonly ttl: number;

  constructor(redis: Redis, config: RedisBackendConfig = {}) {
    this.redis = redis;
    this.keyPrefix = config.keyPrefix || 'hazeljs:discovery:';
    this.ttl = config.ttl || 90; // 90 seconds default
  }

  /**
   * Register a service instance
   */
  async register(instance: ServiceInstance): Promise<void> {
    const key = this.getInstanceKey(instance.id);
    const serviceSetKey = this.getServiceSetKey(instance.name);

    // Store instance data
    await this.redis.setex(key, this.ttl, JSON.stringify(instance));

    // Add to service set
    await this.redis.sadd(serviceSetKey, instance.id);

    // Set expiration on service set (will be refreshed on heartbeat)
    await this.redis.expire(serviceSetKey, this.ttl * 2);
  }

  /**
   * Deregister a service instance
   */
  async deregister(instanceId: string): Promise<void> {
    const key = this.getInstanceKey(instanceId);

    // Get instance to find service name
    const data = await this.redis.get(key);
    if (data) {
      const instance: ServiceInstance = JSON.parse(data);
      const serviceSetKey = this.getServiceSetKey(instance.name);

      // Remove from service set
      await this.redis.srem(serviceSetKey, instanceId);

      // Delete instance data
      await this.redis.del(key);
    }
  }

  /**
   * Update service instance heartbeat
   */
  async heartbeat(instanceId: string): Promise<void> {
    const key = this.getInstanceKey(instanceId);

    // Get current instance
    const data = await this.redis.get(key);
    if (data) {
      const instance: ServiceInstance = JSON.parse(data);

      // Update heartbeat and status
      instance.lastHeartbeat = new Date();
      instance.status = ServiceStatus.UP;

      // Update with new TTL
      await this.redis.setex(key, this.ttl, JSON.stringify(instance));

      // Refresh service set TTL
      const serviceSetKey = this.getServiceSetKey(instance.name);
      await this.redis.expire(serviceSetKey, this.ttl * 2);
    }
  }

  /**
   * Get all instances of a service
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    const serviceSetKey = this.getServiceSetKey(serviceName);

    // Get all instance IDs for this service
    const instanceIds = await this.redis.smembers(serviceSetKey);

    if (instanceIds.length === 0) {
      return [];
    }

    // Get all instance data
    const instances: ServiceInstance[] = [];
    for (const id of instanceIds) {
      const instance = await this.getInstance(id);
      if (instance) {
        instances.push(instance);
      }
    }

    // Apply filters
    if (filter) {
      return this.applyFilter(instances, filter);
    }

    return instances;
  }

  /**
   * Get a specific service instance
   */
  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    const key = this.getInstanceKey(instanceId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const instance: ServiceInstance = JSON.parse(data);

    // Convert date strings back to Date objects
    instance.lastHeartbeat = new Date(instance.lastHeartbeat);
    instance.registeredAt = new Date(instance.registeredAt);

    return instance;
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<string[]> {
    const pattern = `${this.keyPrefix}service:*`;
    const keys = await this.redis.keys(pattern);

    return keys.map((key) => {
      const serviceName = key.replace(`${this.keyPrefix}service:`, '');
      return serviceName;
    });
  }

  /**
   * Update service instance status
   */
  async updateStatus(instanceId: string, status: string): Promise<void> {
    const key = this.getInstanceKey(instanceId);
    const data = await this.redis.get(key);

    if (data) {
      const instance: ServiceInstance = JSON.parse(data);
      instance.status = status as ServiceStatus;

      await this.redis.setex(key, this.ttl, JSON.stringify(instance));
    }
  }

  /**
   * Clean up expired instances
   * Note: Redis handles expiration automatically via TTL
   */
  async cleanup(): Promise<void> {
    // Redis automatically removes expired keys
    // This method can be used for additional cleanup if needed

    const services = await this.getAllServices();

    for (const serviceName of services) {
      const serviceSetKey = this.getServiceSetKey(serviceName);
      const instanceIds = await this.redis.smembers(serviceSetKey);

      // Check each instance and remove if expired
      for (const id of instanceIds) {
        const exists = await this.redis.exists(this.getInstanceKey(id));
        if (!exists) {
          // Instance key expired but still in set, remove it
          await this.redis.srem(serviceSetKey, id);
        }
      }

      // Remove empty service sets
      const count = await this.redis.scard(serviceSetKey);
      if (count === 0) {
        await this.redis.del(serviceSetKey);
      }
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get Redis key for instance
   */
  private getInstanceKey(instanceId: string): string {
    return `${this.keyPrefix}instance:${instanceId}`;
  }

  /**
   * Get Redis key for service set
   */
  private getServiceSetKey(serviceName: string): string {
    return `${this.keyPrefix}service:${serviceName}`;
  }

  /**
   * Apply filter to instances
   */
  private applyFilter(instances: ServiceInstance[], filter: ServiceFilter): ServiceInstance[] {
    return instances.filter((instance) => {
      // Filter by zone
      if (filter.zone && instance.zone !== filter.zone) {
        return false;
      }

      // Filter by status
      if (filter.status && instance.status !== filter.status) {
        return false;
      }

      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        if (!instance.tags || !filter.tags.every((tag) => instance.tags!.includes(tag))) {
          return false;
        }
      }

      // Filter by metadata
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
