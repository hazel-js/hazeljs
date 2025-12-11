/**
 * Service Registry Backend Interface
 */

import { ServiceInstance, ServiceFilter } from '../types';

export interface RegistryBackend {
  /**
   * Register a service instance
   */
  register(instance: ServiceInstance): Promise<void>;

  /**
   * Deregister a service instance
   */
  deregister(instanceId: string): Promise<void>;

  /**
   * Update service instance heartbeat
   */
  heartbeat(instanceId: string): Promise<void>;

  /**
   * Get all instances of a service
   */
  getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]>;

  /**
   * Get a specific service instance
   */
  getInstance(instanceId: string): Promise<ServiceInstance | null>;

  /**
   * Get all registered services
   */
  getAllServices(): Promise<string[]>;

  /**
   * Update service instance status
   */
  updateStatus(instanceId: string, status: string): Promise<void>;

  /**
   * Clean up expired instances
   */
  cleanup(): Promise<void>;
}
