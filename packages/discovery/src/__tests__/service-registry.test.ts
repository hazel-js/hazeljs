/**
 * Service Registry Tests
 */

import { ServiceRegistry } from '../registry/service-registry';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { ServiceStatus } from '../types';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;
  let backend: MemoryRegistryBackend;

  beforeEach(() => {
    backend = new MemoryRegistryBackend();
    registry = new ServiceRegistry(
      {
        name: 'test-service',
        port: 3000,
        host: 'localhost',
        healthCheckPath: '/health',
        metadata: { version: '1.0.0' },
        zone: 'us-east-1',
        tags: ['test'],
      },
      backend
    );
  });

  afterEach(async () => {
    await registry.deregister();
  });

  describe('register', () => {
    it('should register a service instance', async () => {
      await registry.register();

      const instance = registry.getInstance();
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('test-service');
      expect(instance?.port).toBe(3000);
      expect(instance?.zone).toBe('us-east-1');
    });

    it('should set initial status to STARTING or DOWN after health check', async () => {
      await registry.register();

      const instance = registry.getInstance();
      // Status will be STARTING initially, but health check runs immediately
      // Since there's no actual server, it will become DOWN
      expect([ServiceStatus.STARTING, ServiceStatus.DOWN]).toContain(instance?.status);
    });
  });

  describe('deregister', () => {
    it('should deregister a service instance', async () => {
      await registry.register();
      const instanceId = registry.getInstance()?.id;

      await registry.deregister();

      const instance = await backend.getInstance(instanceId!);
      expect(instance).toBeNull();
    });
  });

  describe('getInstance', () => {
    it('should return the registered instance', async () => {
      await registry.register();

      const instance = registry.getInstance();
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('test-service');
    });

    it('should return null before registration', () => {
      const instance = registry.getInstance();
      expect(instance).toBeNull();
    });
  });
});
