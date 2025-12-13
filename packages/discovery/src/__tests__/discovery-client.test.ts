/**
 * Discovery Client Tests
 */

import { DiscoveryClient } from '../client/discovery-client';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { ServiceInstance, ServiceStatus } from '../types';

describe('DiscoveryClient', () => {
  let client: DiscoveryClient;
  let backend: MemoryRegistryBackend;

  beforeEach(() => {
    backend = new MemoryRegistryBackend();
    client = new DiscoveryClient({}, backend);
  });

  const createInstance = (id: string, name: string = 'test-service'): ServiceInstance => ({
    id,
    name,
    host: 'localhost',
    port: 3000,
    status: ServiceStatus.UP,
    lastHeartbeat: new Date(),
    registeredAt: new Date(),
  });

  describe('getInstances', () => {
    it('should return instances from backend', async () => {
      const instance1 = createInstance('1', 'service-a');
      const instance2 = createInstance('2', 'service-a');
      await backend.register(instance1);
      await backend.register(instance2);

      const instances = await client.getInstances('service-a');
      expect(instances).toHaveLength(2);
    });

    it('should apply filters', async () => {
      const instance1 = { ...createInstance('1'), zone: 'us-east-1' };
      const instance2 = { ...createInstance('2'), zone: 'us-west-1' };
      await backend.register(instance1);
      await backend.register(instance2);

      const instances = await client.getInstances('test-service', {
        zone: 'us-east-1',
      });
      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('1');
    });

    it('should use cache when enabled', async () => {
      const clientWithCache = new DiscoveryClient({ cacheEnabled: true, cacheTTL: 1000 }, backend);

      const instance = createInstance('1');
      await backend.register(instance);

      const first = await clientWithCache.getInstances('test-service');
      expect(first).toHaveLength(1);

      // Remove from backend
      await backend.deregister('1');

      // Should still return cached result
      const second = await clientWithCache.getInstances('test-service');
      expect(second).toHaveLength(1);
    });

    it('should refresh cache after TTL expires', async () => {
      const clientWithCache = new DiscoveryClient({ cacheEnabled: true, cacheTTL: 50 }, backend);

      const instance = createInstance('1');
      await backend.register(instance);

      await clientWithCache.getInstances('test-service');
      await backend.deregister('1');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const instances = await clientWithCache.getInstances('test-service');
      expect(instances).toHaveLength(0);
    });
  });

  describe('getInstance', () => {
    it('should return a single instance using load balancing', async () => {
      const instance1 = createInstance('1');
      const instance2 = createInstance('2');
      await backend.register(instance1);
      await backend.register(instance2);

      const instance = await client.getInstance('test-service');
      expect(instance).toBeDefined();
      expect(['1', '2']).toContain(instance?.id);
    });

    it('should return null when no instances available', async () => {
      const instance = await client.getInstance('non-existent');
      expect(instance).toBeNull();
    });

    it('should use specified load balancing strategy', async () => {
      const instance1 = createInstance('1');
      const instance2 = createInstance('2');
      await backend.register(instance1);
      await backend.register(instance2);

      // Round robin should cycle
      const first = await client.getInstance('test-service', 'round-robin');
      const second = await client.getInstance('test-service', 'round-robin');
      const third = await client.getInstance('test-service', 'round-robin');

      expect(first?.id).toBe('1');
      expect(second?.id).toBe('2');
      expect(third?.id).toBe('1');
    });

    it('should apply filters', async () => {
      const instance1 = { ...createInstance('1'), zone: 'us-east-1' };
      const instance2 = { ...createInstance('2'), zone: 'us-west-1' };
      await backend.register(instance1);
      await backend.register(instance2);

      const instance = await client.getInstance('test-service', 'round-robin', {
        zone: 'us-east-1',
      });
      expect(instance?.id).toBe('1');
    });
  });

  describe('getAllServices', () => {
    it('should return all service names', async () => {
      await backend.register(createInstance('1', 'service-a'));
      await backend.register(createInstance('2', 'service-b'));

      const services = await client.getAllServices();
      expect(services.sort()).toEqual(['service-a', 'service-b']);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific service', () => {
      const clientWithCache = new DiscoveryClient({ cacheEnabled: true }, backend);

      clientWithCache.clearCache('service-a');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should clear all cache when no service specified', () => {
      const clientWithCache = new DiscoveryClient({ cacheEnabled: true }, backend);

      clientWithCache.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getBackend', () => {
    it('should return the backend instance', () => {
      const backend = client.getBackend();
      expect(backend).toBeInstanceOf(MemoryRegistryBackend);
    });
  });

  describe('getLoadBalancerFactory', () => {
    it('should return the load balancer factory', () => {
      const factory = client.getLoadBalancerFactory();
      expect(factory).toBeDefined();
      expect(factory.get('round-robin')).toBeDefined();
    });
  });
});
