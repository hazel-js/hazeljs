/**
 * Consul Backend Tests
 * Uses mocked Consul client
 */

import { ConsulRegistryBackend, ConsulClient } from '../backends/consul-backend';
import { ServiceInstance, ServiceStatus } from '../types';
import { DiscoveryLogger } from '../utils/logger';

// Suppress console logs during tests
beforeAll(() => {
  DiscoveryLogger.setLogger({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });
});

afterAll(() => {
  DiscoveryLogger.resetLogger();
});

function createMockConsul(): jest.Mocked<ConsulClient> {
  return {
    agent: {
      service: {
        register: jest.fn().mockResolvedValue(undefined),
        deregister: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue({}),
      },
      check: {
        pass: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
        warn: jest.fn().mockResolvedValue(undefined),
        list: jest.fn().mockResolvedValue({}),
      },
    },
    health: {
      service: jest.fn().mockResolvedValue([]),
    },
    catalog: {
      service: {
        list: jest.fn().mockResolvedValue({}),
      },
    },
  } as unknown as jest.Mocked<ConsulClient>;
}

function createInstance(
  id: string,
  name: string = 'test-service',
  overrides: Partial<ServiceInstance> = {}
): ServiceInstance {
  return {
    id,
    name,
    host: 'localhost',
    port: 3000,
    status: ServiceStatus.UP,
    lastHeartbeat: new Date('2025-01-01T00:00:00Z'),
    registeredAt: new Date('2025-01-01T00:00:00Z'),
    tags: ['web'],
    metadata: { version: '1.0' },
    zone: 'us-east-1',
    ...overrides,
  };
}

describe('ConsulRegistryBackend', () => {
  let consul: jest.Mocked<ConsulClient>;
  let backend: ConsulRegistryBackend;

  beforeEach(() => {
    jest.useFakeTimers();
    consul = createMockConsul();
    backend = new ConsulRegistryBackend(consul);
  });

  afterEach(async () => {
    await backend.close();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should use default TTL of 30s', () => {
      expect(backend).toBeDefined();
    });

    it('should accept custom config', () => {
      const b = new ConsulRegistryBackend(consul, { ttl: '60s' });
      expect(b).toBeDefined();
    });

    it('should throw on invalid TTL format', () => {
      expect(() => {
        new ConsulRegistryBackend(consul, { ttl: 'invalid' });
      }).toThrow();
    });
  });

  describe('register', () => {
    it('should call consul agent service register', async () => {
      const instance = createInstance('svc-1', 'my-service');
      await backend.register(instance);

      expect(consul.agent.service.register).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'svc-1',
          name: 'my-service',
          address: 'localhost',
          port: 3000,
        })
      );
    });

    it('should start TTL check interval', async () => {
      const instance = createInstance('svc-1');
      await backend.register(instance);

      // Advance timers past the TTL check interval (2/3 of 30s = 20s)
      jest.advanceTimersByTime(21000);

      expect(consul.agent.check.pass).toHaveBeenCalledWith('service:svc-1');
    });
  });

  describe('deregister', () => {
    it('should call consul agent service deregister', async () => {
      const instance = createInstance('svc-1');
      await backend.register(instance);
      await backend.deregister('svc-1');

      expect(consul.agent.service.deregister).toHaveBeenCalledWith('svc-1');
    });

    it('should stop TTL check interval', async () => {
      const instance = createInstance('svc-1');
      await backend.register(instance);
      await backend.deregister('svc-1');

      jest.clearAllMocks();
      jest.advanceTimersByTime(30000);

      // TTL check should NOT have been called after deregister
      expect(consul.agent.check.pass).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('should pass the TTL check', async () => {
      await backend.heartbeat('svc-1');
      expect(consul.agent.check.pass).toHaveBeenCalledWith('service:svc-1');
    });

    it('should not throw when consul fails', async () => {
      (consul.agent.check.pass as jest.Mock).mockRejectedValueOnce(new Error('Consul error'));
      await expect(backend.heartbeat('svc-1')).resolves.not.toThrow();
    });
  });

  describe('getInstances', () => {
    it('should return instances from consul health service', async () => {
      (consul.health.service as jest.Mock).mockResolvedValueOnce([
        {
          Service: {
            ID: 'svc-1',
            Service: 'my-service',
            Address: '10.0.0.1',
            Port: 8080,
            Meta: { zone: 'us-east-1', registeredAt: '2025-01-01T00:00:00Z' },
            Tags: ['web'],
          },
          Checks: [{ Status: 'passing' }],
        },
        {
          Service: {
            ID: 'svc-2',
            Service: 'my-service',
            Address: '10.0.0.2',
            Port: 8080,
            Meta: { zone: 'us-west-1' },
            Tags: ['api'],
          },
          Checks: [{ Status: 'passing' }],
        },
      ]);

      const instances = await backend.getInstances('my-service');
      expect(instances).toHaveLength(2);
      expect(instances[0].id).toBe('svc-1');
      expect(instances[0].host).toBe('10.0.0.1');
    });

    it('should set status based on check results', async () => {
      (consul.health.service as jest.Mock).mockResolvedValueOnce([
        {
          Service: {
            ID: 'svc-1',
            Service: 'my-service',
            Address: '10.0.0.1',
            Port: 8080,
          },
          Checks: [{ Status: 'critical' }],
        },
        {
          Service: {
            ID: 'svc-2',
            Service: 'my-service',
            Address: '10.0.0.2',
            Port: 8080,
          },
          Checks: [{ Status: 'warning' }],
        },
      ]);

      const instances = await backend.getInstances('my-service');
      expect(instances[0].status).toBe(ServiceStatus.DOWN);
      expect(instances[1].status).toBe(ServiceStatus.STARTING);
    });

    it('should filter instances', async () => {
      (consul.health.service as jest.Mock).mockResolvedValueOnce([
        {
          Service: {
            ID: 'svc-1',
            Service: 'my-service',
            Address: '10.0.0.1',
            Port: 8080,
            Meta: { zone: 'us-east-1' },
          },
          Checks: [],
        },
        {
          Service: {
            ID: 'svc-2',
            Service: 'my-service',
            Address: '10.0.0.2',
            Port: 8080,
            Meta: { zone: 'us-west-1' },
          },
          Checks: [],
        },
      ]);

      const instances = await backend.getInstances('my-service', { zone: 'us-east-1' });
      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('svc-1');
    });

    it('should return empty array on error', async () => {
      (consul.health.service as jest.Mock).mockRejectedValueOnce(new Error('Consul error'));

      const instances = await backend.getInstances('my-service');
      expect(instances).toEqual([]);
    });
  });

  describe('getInstance', () => {
    it('should return a specific instance', async () => {
      (consul.agent.service.list as jest.Mock).mockResolvedValueOnce({
        'svc-1': {
          ID: 'svc-1',
          Service: 'my-service',
          Address: '10.0.0.1',
          Port: 8080,
          Meta: { zone: 'us-east-1' },
          Tags: ['web'],
        },
      });
      (consul.agent.check.list as jest.Mock).mockResolvedValueOnce({
        'service:svc-1': { Status: 'passing' },
      });

      const instance = await backend.getInstance('svc-1');
      expect(instance).toBeDefined();
      expect(instance!.id).toBe('svc-1');
      expect(instance!.status).toBe(ServiceStatus.UP);
    });

    it('should return null for non-existent instance', async () => {
      (consul.agent.service.list as jest.Mock).mockResolvedValueOnce({});

      const instance = await backend.getInstance('non-existent');
      expect(instance).toBeNull();
    });

    it('should return null on error', async () => {
      (consul.agent.service.list as jest.Mock).mockRejectedValueOnce(new Error('fail'));

      const instance = await backend.getInstance('svc-1');
      expect(instance).toBeNull();
    });
  });

  describe('getAllServices', () => {
    it('should return service names from catalog', async () => {
      (consul.catalog.service.list as jest.Mock).mockResolvedValueOnce({
        'service-a': [],
        'service-b': [],
        consul: [],
      });

      const services = await backend.getAllServices();
      expect(services).toEqual(['service-a', 'service-b', 'consul']);
    });

    it('should return empty array on error', async () => {
      (consul.catalog.service.list as jest.Mock).mockRejectedValueOnce(new Error('fail'));

      const services = await backend.getAllServices();
      expect(services).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should pass check for UP status', async () => {
      await backend.updateStatus('svc-1', ServiceStatus.UP);
      expect(consul.agent.check.pass).toHaveBeenCalledWith('service:svc-1');
    });

    it('should fail check for DOWN status', async () => {
      await backend.updateStatus('svc-1', ServiceStatus.DOWN);
      expect(consul.agent.check.fail).toHaveBeenCalledWith('service:svc-1');
    });

    it('should warn check for STARTING status', async () => {
      await backend.updateStatus('svc-1', ServiceStatus.STARTING);
      expect(consul.agent.check.warn).toHaveBeenCalledWith('service:svc-1');
    });

    it('should not throw on error', async () => {
      (consul.agent.check.pass as jest.Mock).mockRejectedValueOnce(new Error('fail'));
      await expect(backend.updateStatus('svc-1', ServiceStatus.UP)).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('should stop all TTL check intervals', async () => {
      const i1 = createInstance('svc-1');
      const i2 = createInstance('svc-2');
      await backend.register(i1);
      await backend.register(i2);

      await backend.close();

      jest.clearAllMocks();
      jest.advanceTimersByTime(60000);

      expect(consul.agent.check.pass).not.toHaveBeenCalled();
    });
  });
});
