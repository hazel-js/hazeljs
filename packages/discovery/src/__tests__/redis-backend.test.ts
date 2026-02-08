/**
 * Redis Backend Tests
 * Uses mocked ioredis client
 */

import { RedisRegistryBackend } from '../backends/redis-backend';
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

/** Helper to create a mock Redis instance */
function createMockRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  const mock = {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    }),

    setex: jest.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, value);
      ttls.set(key, ttl);
    }),

    get: jest.fn(async (key: string) => store.get(key) || null),

    del: jest.fn(async (key: string) => {
      store.delete(key);
      ttls.delete(key);
      return 1;
    }),

    mget: jest.fn(async (...keys: string[]) => {
      // mget can receive keys as individual args or a single array
      const flatKeys = keys.flat();
      return flatKeys.map((k) => store.get(k) || null);
    }),

    sadd: jest.fn(async (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return 1;
    }),

    srem: jest.fn(async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    }),

    smembers: jest.fn(async (key: string) => {
      return Array.from(sets.get(key) || []);
    }),

    scard: jest.fn(async (key: string) => {
      return sets.get(key)?.size || 0;
    }),

    exists: jest.fn(async (key: string) => {
      return store.has(key) ? 1 : 0;
    }),

    expire: jest.fn(async () => 1),

    scan: jest.fn(async (_cursor: string, _match: string, pattern: string) => {
      const keys = Array.from(sets.keys()).filter((k) => {
        // Simple glob match: convert "prefix*" to regex
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(k);
      });
      return ['0', keys];
    }),

    quit: jest.fn(async () => 'OK'),

    // Helper to emit events during tests
    _emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach((h) => h(...args));
    },
  };

  return mock;
}

type MockRedis = ReturnType<typeof createMockRedis>;

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
    ...overrides,
  };
}

describe('RedisRegistryBackend', () => {
  let redis: MockRedis;
  let backend: RedisRegistryBackend;

  beforeEach(() => {
    redis = createMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backend = new RedisRegistryBackend(redis as any);
  });

  describe('constructor', () => {
    it('should use default config values', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = new RedisRegistryBackend(redis as any);
      expect(b).toBeDefined();
    });

    it('should accept custom config', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = new RedisRegistryBackend(redis as any, {
        keyPrefix: 'custom:',
        ttl: 120,
      });
      expect(b).toBeDefined();
    });

    it('should throw on invalid TTL', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new RedisRegistryBackend(redis as any, { ttl: -5 });
      }).toThrow();
    });

    it('should register connection event handlers', () => {
      expect(redis.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(redis.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(redis.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(redis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('register', () => {
    it('should store the instance with TTL', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      expect(redis.setex).toHaveBeenCalledWith(
        'hazeljs:discovery:instance:1',
        90,
        JSON.stringify(instance)
      );
    });

    it('should add instance to service set', async () => {
      const instance = createInstance('1', 'my-service');
      await backend.register(instance);

      expect(redis.sadd).toHaveBeenCalledWith('hazeljs:discovery:service:my-service', '1');
    });

    it('should set expiration on service set', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      expect(redis.expire).toHaveBeenCalledWith('hazeljs:discovery:service:test-service', 180);
    });
  });

  describe('deregister', () => {
    it('should remove instance from Redis', async () => {
      const instance = createInstance('1');
      await backend.register(instance);
      await backend.deregister('1');

      expect(redis.srem).toHaveBeenCalledWith('hazeljs:discovery:service:test-service', '1');
      expect(redis.del).toHaveBeenCalledWith('hazeljs:discovery:instance:1');
    });

    it('should do nothing if instance does not exist', async () => {
      await backend.deregister('non-existent');
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('should update heartbeat timestamp and status', async () => {
      const instance = createInstance('1');
      instance.status = ServiceStatus.DOWN;
      await backend.register(instance);

      await backend.heartbeat('1');

      // Should have been called again with updated data
      expect(redis.setex).toHaveBeenCalledTimes(2);
      const lastCall = redis.setex.mock.calls[1];
      const storedInstance = JSON.parse(lastCall[2]);
      expect(storedInstance.status).toBe(ServiceStatus.UP);
    });

    it('should do nothing if instance does not exist', async () => {
      await backend.heartbeat('non-existent');
      // setex should not be called
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('getInstances', () => {
    it('should return all instances for a service using MGET', async () => {
      const i1 = createInstance('1', 'svc');
      const i2 = createInstance('2', 'svc');
      await backend.register(i1);
      await backend.register(i2);

      const instances = await backend.getInstances('svc');
      expect(instances).toHaveLength(2);
      expect(redis.mget).toHaveBeenCalled();
    });

    it('should return empty array for non-existent service', async () => {
      const instances = await backend.getInstances('non-existent');
      expect(instances).toEqual([]);
    });

    it('should apply filter', async () => {
      const i1 = createInstance('1', 'svc', { zone: 'us-east-1' });
      const i2 = createInstance('2', 'svc', { zone: 'us-west-1' });
      await backend.register(i1);
      await backend.register(i2);

      const instances = await backend.getInstances('svc', { zone: 'us-east-1' });
      expect(instances).toHaveLength(1);
      expect(instances[0].zone).toBe('us-east-1');
    });
  });

  describe('getInstance', () => {
    it('should return a specific instance', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const retrieved = await backend.getInstance('1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('1');
    });

    it('should return null for non-existent instance', async () => {
      const result = await backend.getInstance('non-existent');
      expect(result).toBeNull();
    });

    it('should convert dates back from strings', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      const retrieved = await backend.getInstance('1');
      expect(retrieved!.lastHeartbeat).toBeInstanceOf(Date);
      expect(retrieved!.registeredAt).toBeInstanceOf(Date);
    });
  });

  describe('getAllServices', () => {
    it('should use SCAN instead of KEYS', async () => {
      const i1 = createInstance('1', 'svc-a');
      const i2 = createInstance('2', 'svc-b');
      await backend.register(i1);
      await backend.register(i2);

      const services = await backend.getAllServices();
      expect(redis.scan).toHaveBeenCalled();
      expect(services).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of an instance', async () => {
      const instance = createInstance('1');
      await backend.register(instance);

      await backend.updateStatus('1', ServiceStatus.DOWN);

      const retrieved = await backend.getInstance('1');
      expect(retrieved!.status).toBe(ServiceStatus.DOWN);
    });

    it('should do nothing for non-existent instance', async () => {
      await backend.updateStatus('non-existent', ServiceStatus.DOWN);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove stale entries from service sets', async () => {
      const instance = createInstance('1', 'svc');
      await backend.register(instance);

      // Simulate the instance key expiring in Redis
      redis.exists.mockResolvedValueOnce(0);

      await backend.cleanup();

      expect(redis.srem).toHaveBeenCalledWith('hazeljs:discovery:service:svc', '1');
    });
  });

  describe('connection error handling', () => {
    it('should track connection state via events', () => {
      redis._emit('close');
      // Backend should mark as disconnected
      // Next operation should throw
      expect(backend.getInstances('svc')).rejects.toThrow('Redis backend is not connected');
    });

    it('should recover on connect event', async () => {
      redis._emit('close');
      redis._emit('connect');
      // Should work again
      const result = await backend.getInstances('svc');
      expect(result).toEqual([]);
    });
  });

  describe('close', () => {
    it('should call redis.quit()', async () => {
      await backend.close();
      expect(redis.quit).toHaveBeenCalled();
    });
  });
});
