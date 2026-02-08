/**
 * In-Memory Registry Backend
 * For development and testing
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';
import { applyServiceFilter } from '../utils/filter';

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

    const instances: ServiceInstance[] = [];
    for (const id of instanceIds) {
      const instance = this.instances.get(id);
      if (instance) {
        instances.push(instance);
      }
    }

    // Apply filters
    return applyServiceFilter(instances, filter);
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
}
