/**
 * Memory Backend Tests
 */

import { MemoryRegistryBackend } from '../backends/memory-backend';
import { ServiceInstance, ServiceStatus } from '../types';

describe('MemoryRegistryBackend', () => {
  let backend: MemoryRegistryBackend;

  beforeEach(() => {
    backend = new MemoryRegistryBackend();
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

  describe('register', () => {
    it('should register a service instance', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toEqual(instance);
    });

    it('should index instances by service name', async () => {
      const instance1 = createInstance('1', 'service-a');
      const instance2 = createInstance('2', 'service-a');
      const instance3 = createInstance('3', 'service-b');

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instancesA = await backend.getInstances('service-a');
      const instancesB = await backend.getInstances('service-b');

      expect(instancesA).toHaveLength(2);
      expect(instancesB).toHaveLength(1);
    });
  });

  describe('deregister', () => {
    it('should remove a registered instance', async () => {
      const instance = createInstance('1');
      await backend.register(instance);
      await backend.deregister('1');

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toBeNull();
    });

    it('should clean up service index when last instance is removed', async () => {
      const instance = createInstance('1', 'service-a');
      await backend.register(instance);

      const servicesBefore = await backend.getAllServices();
      expect(servicesBefore).toContain('service-a');

      await backend.deregister('1');

      const servicesAfter = await backend.getAllServices();
      expect(servicesAfter).not.toContain('service-a');
    });
  });

  describe('heartbeat', () => {
    it('should update lastHeartbeat and set status to UP', async () => {
      const instance = createInstance('1');
      instance.status = ServiceStatus.DOWN;
      await backend.register(instance);

      const before = await backend.getInstance('1');
      const beforeTime = before!.lastHeartbeat.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await backend.heartbeat('1');

      const after = await backend.getInstance('1');
      expect(after!.lastHeartbeat.getTime()).toBeGreaterThan(beforeTime);
      expect(after!.status).toBe(ServiceStatus.UP);
    });
  });

  describe('getInstances', () => {
    it('should return all instances for a service', async () => {
      const instance1 = createInstance('1', 'service-a');
      const instance2 = createInstance('2', 'service-a');
      const instance3 = createInstance('3', 'service-b');

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('service-a');
      expect(instances).toHaveLength(2);
      expect(instances.map((i) => i.id)).toEqual(['1', '2']);
    });

    it('should return empty array for non-existent service', async () => {
      const instances = await backend.getInstances('non-existent');
      expect(instances).toEqual([]);
    });

    it('should filter by zone', async () => {
      const instance1 = { ...createInstance('1'), zone: 'us-east-1' };
      const instance2 = { ...createInstance('2'), zone: 'us-west-1' };
      const instance3 = { ...createInstance('3'), zone: 'us-east-1' };

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('test-service', {
        zone: 'us-east-1',
      });

      expect(instances).toHaveLength(2);
      expect(instances.every((i) => i.zone === 'us-east-1')).toBe(true);
    });

    it('should filter by status', async () => {
      const instance1 = { ...createInstance('1'), status: ServiceStatus.UP };
      const instance2 = { ...createInstance('2'), status: ServiceStatus.DOWN };
      const instance3 = { ...createInstance('3'), status: ServiceStatus.UP };

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('test-service', {
        status: ServiceStatus.UP,
      });

      expect(instances).toHaveLength(2);
      expect(instances.every((i) => i.status === ServiceStatus.UP)).toBe(true);
    });

    it('should filter by tags', async () => {
      const instance1 = { ...createInstance('1'), tags: ['web', 'api'] };
      const instance2 = { ...createInstance('2'), tags: ['api'] };
      const instance3 = { ...createInstance('3'), tags: ['web'] };

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('test-service', {
        tags: ['web', 'api'],
      });

      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('1');
    });

    it('should filter by metadata', async () => {
      const instance1 = {
        ...createInstance('1'),
        metadata: { version: '1.0.0', env: 'prod' },
      };
      const instance2 = {
        ...createInstance('2'),
        metadata: { version: '2.0.0', env: 'prod' },
      };
      const instance3 = {
        ...createInstance('3'),
        metadata: { version: '1.0.0', env: 'dev' },
      };

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('test-service', {
        metadata: { version: '1.0.0' },
      });

      expect(instances).toHaveLength(2);
      expect(instances.every((i) => i.metadata?.version === '1.0.0')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const instance1 = {
        ...createInstance('1'),
        zone: 'us-east-1',
        status: ServiceStatus.UP,
        tags: ['web'],
      };
      const instance2 = {
        ...createInstance('2'),
        zone: 'us-east-1',
        status: ServiceStatus.DOWN,
        tags: ['web'],
      };
      const instance3 = {
        ...createInstance('3'),
        zone: 'us-west-1',
        status: ServiceStatus.UP,
        tags: ['web'],
      };

      await backend.register(instance1);
      await backend.register(instance2);
      await backend.register(instance3);

      const instances = await backend.getInstances('test-service', {
        zone: 'us-east-1',
        status: ServiceStatus.UP,
        tags: ['web'],
      });

      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('1');
    });
  });

  describe('getInstance', () => {
    it('should return instance by ID', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toEqual(instance);
    });

    it('should return null for non-existent instance', async () => {
      const retrieved = await backend.getInstance('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllServices', () => {
    it('should return all registered service names', async () => {
      await backend.register(createInstance('1', 'service-a'));
      await backend.register(createInstance('2', 'service-a'));
      await backend.register(createInstance('3', 'service-b'));

      const services = await backend.getAllServices();
      expect(services.sort()).toEqual(['service-a', 'service-b']);
    });

    it('should return empty array when no services registered', async () => {
      const services = await backend.getAllServices();
      expect(services).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update instance status', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      await backend.updateStatus('1', ServiceStatus.DOWN);
      const updated = await backend.getInstance('1');
      expect(updated!.status).toBe(ServiceStatus.DOWN);

      await backend.updateStatus('1', ServiceStatus.UP);
      const updated2 = await backend.getInstance('1');
      expect(updated2!.status).toBe(ServiceStatus.UP);
    });

    it('should not throw error for non-existent instance', async () => {
      await expect(backend.updateStatus('non-existent', ServiceStatus.DOWN)).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove expired instances', async () => {
      const backend = new MemoryRegistryBackend(100); // 100ms expiration
      const instance = createInstance('1');
      await backend.register(instance);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      await backend.cleanup();

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toBeNull();
    });

    it('should not remove active instances', async () => {
      const backend = new MemoryRegistryBackend(100);
      const instance = createInstance('1');
      await backend.register(instance);

      // Update heartbeat before expiration
      await new Promise((resolve) => setTimeout(resolve, 50));
      await backend.heartbeat('1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      await backend.cleanup();

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toBeDefined();
    });
  });
});
