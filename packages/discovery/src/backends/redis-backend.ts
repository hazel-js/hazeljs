/**
 * Redis Registry Backend
 * For production distributed service registry
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';
import { applyServiceFilter } from '../utils/filter';
import { DiscoveryLogger } from '../utils/logger';
import { validateRedisBackendConfig } from '../utils/validation';
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
  private connected = true;

  constructor(redis: Redis, config: RedisBackendConfig = {}) {
    validateRedisBackendConfig(config);

    this.redis = redis;
    this.keyPrefix = config.keyPrefix || 'hazeljs:discovery:';
    this.ttl = config.ttl || 90; // 90 seconds default

    this.setupConnectionHandlers();
  }

  /**
   * Set up Redis connection event handlers for resilience
   */
  private setupConnectionHandlers(): void {
    const logger = DiscoveryLogger.getLogger();

    this.redis.on('error', (err: Error) => {
      this.connected = false;
      logger.error('Redis connection error', err);
    });

    this.redis.on('connect', () => {
      this.connected = true;
      logger.info('Redis connected');
    });

    this.redis.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    this.redis.on('close', () => {
      this.connected = false;
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Check Redis connectivity before operations
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Redis backend is not connected');
    }
  }

  /**
   * Register a service instance
   */
  async register(instance: ServiceInstance): Promise<void> {
    this.ensureConnected();

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
    this.ensureConnected();

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
    this.ensureConnected();

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
   * Get all instances of a service (uses MGET for efficiency)
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    this.ensureConnected();

    const serviceSetKey = this.getServiceSetKey(serviceName);

    // Get all instance IDs for this service
    const instanceIds = await this.redis.smembers(serviceSetKey);

    if (instanceIds.length === 0) {
      return [];
    }

    // Batch-fetch all instances with MGET
    const keys = instanceIds.map((id) => this.getInstanceKey(id));
    const results = await this.redis.mget(...keys);

    const instances: ServiceInstance[] = [];
    for (const data of results) {
      if (data) {
        const instance: ServiceInstance = JSON.parse(data);
        instance.lastHeartbeat = new Date(instance.lastHeartbeat);
        instance.registeredAt = new Date(instance.registeredAt);
        instances.push(instance);
      }
    }

    // Apply filters
    return applyServiceFilter(instances, filter);
  }

  /**
   * Get a specific service instance
   */
  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    this.ensureConnected();

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
   * Get all registered services using SCAN (safe for production)
   */
  async getAllServices(): Promise<string[]> {
    this.ensureConnected();

    const pattern = `${this.keyPrefix}service:*`;
    const prefixLen = `${this.keyPrefix}service:`.length;
    const services: string[] = [];

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        services.push(key.substring(prefixLen));
      }
    } while (cursor !== '0');

    return services;
  }

  /**
   * Update service instance status
   */
  async updateStatus(instanceId: string, status: string): Promise<void> {
    this.ensureConnected();

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
    this.ensureConnected();

    // Redis automatically removes expired keys
    // This method cleans up stale entries in service sets

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
}
