/**
 * In-Memory Registry Backend
 * For development and testing
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';

export class MemoryRegistryBackend implements RegistryBackend {
  private instances = new Map<string, ServiceInstance>();
  private serviceIndex = new Map<string, Set<string>>();
  private readonly expirationTime: number;

  constructor(expirationTime = 90000) {
    // 90 seconds default
    this.expirationTime = expirationTime;
  }

  async register(instance: ServiceInstance): Promise<void> {
    this.instances.set(instance.id, instance);

    // Update service index
    if (!this.serviceIndex.has(instance.name)) {
      this.serviceIndex.set(instance.name, new Set());
    }
    this.serviceIndex.get(instance.name)!.add(instance.id);
  }

  async deregister(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      this.instances.delete(instanceId);

      // Update service index
      const serviceInstances = this.serviceIndex.get(instance.name);
      if (serviceInstances) {
        serviceInstances.delete(instanceId);
        if (serviceInstances.size === 0) {
          this.serviceIndex.delete(instance.name);
        }
      }
    }
  }

  async heartbeat(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastHeartbeat = new Date();
      instance.status = ServiceStatus.UP;
    }
  }

  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    const instanceIds = this.serviceIndex.get(serviceName);
    if (!instanceIds) return [];

    let instances: ServiceInstance[] = [];
    for (const id of instanceIds) {
      const instance = this.instances.get(id);
      if (instance) {
        instances.push(instance);
      }
    }

    // Apply filters
    if (filter) {
      instances = this.applyFilter(instances, filter);
    }

    return instances;
  }

  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    return this.instances.get(instanceId) || null;
  }

  async getAllServices(): Promise<string[]> {
    return Array.from(this.serviceIndex.keys());
  }

  async updateStatus(instanceId: string, status: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status as ServiceStatus;
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, instance] of this.instances) {
      const timeSinceHeartbeat = now - instance.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > this.expirationTime) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      await this.deregister(id);
    }
  }

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
