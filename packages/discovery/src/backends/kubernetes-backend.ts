/**
 * Kubernetes Registry Backend
 * Uses Kubernetes Service Discovery
 */

import { RegistryBackend } from './registry-backend';
import { ServiceInstance, ServiceFilter, ServiceStatus } from '../types';

// Type definitions for Kubernetes (optional peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KubeConfig = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CoreV1Api = any;

export interface KubernetesBackendConfig {
  namespace?: string;
  labelSelector?: string;
}

export class KubernetesRegistryBackend implements RegistryBackend {
  private k8sApi: CoreV1Api;
  private readonly namespace: string;
  private readonly labelSelector: string;

  constructor(kubeConfig: KubeConfig, config: KubernetesBackendConfig = {}) {
    // Import CoreV1Api dynamically to avoid build errors when @kubernetes/client-node is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CoreV1Api: CoreV1ApiClass } = require('@kubernetes/client-node');
    this.k8sApi = kubeConfig.makeApiClient(CoreV1ApiClass);
    this.namespace = config.namespace || 'default';
    this.labelSelector = config.labelSelector || 'app.kubernetes.io/managed-by=hazeljs';
  }

  /**
   * Register a service instance
   * In Kubernetes, services are registered via Service/Endpoints objects
   * This is typically handled by K8s itself
   */
  async register(_instance: ServiceInstance): Promise<void> {
    // In Kubernetes, service registration is handled by the platform
    // We can optionally create/update annotations on the pod
    // Service registration is managed by Kubernetes
  }

  /**
   * Deregister a service instance
   * In Kubernetes, this is handled automatically when pods terminate
   */
  async deregister(_instanceId: string): Promise<void> {
    // Service deregistration is managed by Kubernetes
  }

  /**
   * Update service instance heartbeat
   * Kubernetes handles liveness/readiness probes
   */
  async heartbeat(_instanceId: string): Promise<void> {
    // Kubernetes handles health checks via probes
    // No manual heartbeat needed
  }

  /**
   * Get all instances of a service from Kubernetes Endpoints
   */
  async getInstances(serviceName: string, filter?: ServiceFilter): Promise<ServiceInstance[]> {
    try {
      // Get service endpoints
      const endpointsResponse = await this.k8sApi.readNamespacedEndpoints(
        serviceName,
        this.namespace
      );

      const endpoints = endpointsResponse.body;
      const instances: ServiceInstance[] = [];

      if (!endpoints.subsets) {
        return [];
      }

      // Process each subset
      for (const subset of endpoints.subsets) {
        const ports = subset.ports || [];
        const addresses = subset.addresses || [];
        const notReadyAddresses = subset.notReadyAddresses || [];

        // Process ready addresses
        for (const address of addresses) {
          for (const port of ports) {
            const instance = this.createServiceInstance(
              serviceName,
              address,
              port,
              ServiceStatus.UP,
              endpoints.metadata
            );
            instances.push(instance);
          }
        }

        // Process not-ready addresses
        for (const address of notReadyAddresses) {
          for (const port of ports) {
            const instance = this.createServiceInstance(
              serviceName,
              address,
              port,
              ServiceStatus.STARTING,
              endpoints.metadata
            );
            instances.push(instance);
          }
        }
      }

      // Apply filters
      if (filter) {
        return this.applyFilter(instances, filter);
      }

      return instances;
    } catch {
      return [];
    }
  }

  /**
   * Get a specific service instance
   */
  async getInstance(instanceId: string): Promise<ServiceInstance | null> {
    // Parse instanceId to get service name and address
    const [serviceName] = instanceId.split(':');

    const instances = await this.getInstances(serviceName);
    return instances.find((i) => i.id === instanceId) || null;
  }

  /**
   * Get all registered services in the namespace
   */
  async getAllServices(): Promise<string[]> {
    try {
      const servicesResponse = await this.k8sApi.listNamespacedService(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        this.labelSelector
      );

      return servicesResponse.body.items.map(
        (service: { metadata?: { name?: string } }) => service.metadata?.name || ''
      );
    } catch {
      return [];
    }
  }

  /**
   * Update service instance status
   * In Kubernetes, status is managed by readiness probes
   */
  async updateStatus(_instanceId: string, _status: string): Promise<void> {
    // Kubernetes manages status via probes
  }

  /**
   * Clean up expired instances
   * Kubernetes handles this automatically
   */
  async cleanup(): Promise<void> {
    // Kubernetes automatically removes terminated pods
  }

  /**
   * Create a ServiceInstance from Kubernetes endpoint data
   */
  private createServiceInstance(
    serviceName: string,
    address: { ip: string; targetRef?: { name?: string }; nodeName?: string },
    port: { port: number },
    status: ServiceStatus,
    metadata: {
      annotations?: Record<string, string>;
      labels?: Record<string, string>;
      creationTimestamp?: string;
    }
  ): ServiceInstance {
    const host = address.ip;
    const portNumber = port.port;
    const instanceId = `${serviceName}:${host}:${portNumber}`;

    // Extract metadata from annotations and labels
    const annotations = metadata?.annotations || {};
    const labels = metadata?.labels || {};

    return {
      id: instanceId,
      name: serviceName,
      host,
      port: portNumber,
      status,
      metadata: {
        ...annotations,
        podName: address.targetRef?.name,
        nodeName: address.nodeName,
      },
      tags: Object.keys(labels),
      zone:
        labels['topology.kubernetes.io/zone'] || labels['failure-domain.beta.kubernetes.io/zone'],
      lastHeartbeat: new Date(),
      registeredAt: new Date(metadata?.creationTimestamp || Date.now()),
    };
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
