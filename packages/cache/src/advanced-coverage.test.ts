import 'reflect-metadata';
import {
  CacheAside,
  CacheAsideBuilder,
  CacheAsideWithFallback,
  getCacheAsideMetadata,
  hasCacheAsideMetadata,
} from './decorators/cache-aside.decorator';
import {
  CacheWrite,
  CacheWriteBuilder,
  WriteBehind,
  WriteThrough,
  getCacheWriteMetadata,
  hasCacheWriteMetadata,
} from './decorators/cache-write.decorator';
import {
  CacheWarm,
  CacheWarmBuilder,
  CacheWarmingUtils,
  getCacheWarmMetadata,
  hasCacheWarmMetadata,
} from './decorators/cache-warm.decorator';
import {
  CacheLock,
  CacheLockBuilder,
  getCacheLockMetadata,
  hasCacheLockMetadata,
} from './decorators/cache-lock.decorator';
import {
  LockManager,
  MemoryDistributedLock,
  RedisDistributedLock,
} from './strategies/distributed-lock.strategy';

jest.mock('node-cron', () => ({
  validate: jest.fn(() => true),
  schedule: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
}));

const cron = jest.requireMock('node-cron') as {
  validate: jest.Mock;
  schedule: jest.Mock;
};

jest.mock('@hazeljs/core', () => {
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    __esModule: true,
    default: logger,
    logger,
    Service: () => () => undefined,
  };
});

describe('Advanced cache coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cron.validate.mockReturnValue(true);
    CacheWarmingUtils.destroy();
  });

  afterEach(() => {
    CacheWarmingUtils.destroy();
    jest.useRealTimers();
  });

  describe('CacheAside decorators', () => {
    it('handles miss -> set -> hit with metadata helpers', async () => {
      const get = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: '1', name: 'cached' });
      const set = jest.fn().mockResolvedValue(undefined);

      class AsideService {
        public cacheService = { get, set };
        public dbCalls = 0;

        @CacheAside({ key: 'user-{0}', ttl: 120 })
        async getUser(id: string) {
          this.dbCalls++;
          return { id, name: 'fresh' };
        }
      }

      const svc = new AsideService();
      const a = await svc.getUser('1');
      const b = await svc.getUser('1');

      expect(a).toEqual({ id: '1', name: 'fresh' });
      expect(b).toEqual({ id: '1', name: 'cached' });
      expect(svc.dbCalls).toBe(1);
      expect(set).toHaveBeenCalledWith('user-1', { id: '1', name: 'fresh' }, { ttl: 120 });
      expect(hasCacheAsideMetadata(AsideService.prototype, 'getUser')).toBe(true);
      expect(getCacheAsideMetadata(AsideService.prototype, 'getUser')?.ttl).toBe(120);
    });

    it('falls back to original method when cache service is missing', async () => {
      class AsideNoCacheService {
        public calls = 0;

        @CacheAside({ key: 'x-{0}', ttl: 10 })
        async getValue(v: string) {
          this.calls++;
          return `raw-${v}`;
        }
      }

      const svc = new AsideNoCacheService();
      await expect(svc.getValue('a')).resolves.toBe('raw-a');
      expect(svc.calls).toBe(1);
    });

    it('supports builder and fallback decorators', async () => {
      class AsideBuilderService {
        public cacheService = {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue(undefined),
        };

        @CacheAsideBuilder({ ttl: 90 })
        async list(input: { id: number }) {
          return { ok: true, id: input.id };
        }

        @CacheAsideWithFallback({ key: 'fallback-{0}', ttl: 30, fallbackValue: { id: 0 } })
        async detail(_id: string) {
          return null;
        }
      }

      const svc = new AsideBuilderService();
      await svc.list({ id: 7 });
      await svc.detail('x');
      expect(getCacheAsideMetadata(AsideBuilderService.prototype, 'list')?.key).toContain(
        'asidebuilderservice-list'
      );
      expect(
        getCacheAsideMetadata(AsideBuilderService.prototype, 'detail')?.fallback
      ).toBeDefined();
    });
  });

  describe('CacheWrite decorators', () => {
    it('supports write-through and metadata helpers', async () => {
      const set = jest.fn().mockResolvedValue(undefined);
      class WriteService {
        public cacheService = { get: jest.fn(), set };

        @WriteThrough({ key: 'item-{0}', ttl: 30 })
        async update(id: string, v: string) {
          return { id, v };
        }
      }

      const svc = new WriteService();
      await svc.update('1', 'a');
      expect(set).toHaveBeenCalledWith('item-1', { id: '1', v: 'a' }, 30);
      expect(hasCacheWriteMetadata(WriteService.prototype, 'update')).toBe(true);
      expect(getCacheWriteMetadata(WriteService.prototype, 'update')?.strategy).toBe(
        'write-through'
      );
    });

    it('supports write-behind async queue and sync mode', async () => {
      jest.useFakeTimers();
      const set = jest.fn().mockResolvedValue(undefined);

      class AsyncWriteService {
        public cacheService = { get: jest.fn(), set };

        @WriteBehind({ key: 'w-{0}', ttl: 20, async: true })
        async update(id: string) {
          return { id };
        }
      }

      const svc = new AsyncWriteService();
      await svc.update('10');
      expect(set).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(set).toHaveBeenCalledWith('w-10', { id: '10' }, 20);

      class SyncWriteService {
        public cacheService = { get: jest.fn(), set };

        @CacheWrite({ strategy: 'write-behind', key: 'sync-{0}', ttl: 55, async: false })
        async update(id: string) {
          return { id };
        }
      }

      const syncSvc = new SyncWriteService();
      await syncSvc.update('2');
      expect(set).toHaveBeenCalledWith('sync-2', { id: '2' }, 55);
    });

    it('handles no cache service, builder path, and operation errors', async () => {
      class NoCache {
        @CacheWriteBuilder({ strategy: 'write-through', ttl: 10 })
        async run(v: string) {
          return `ok-${v}`;
        }
      }

      const noCache = new NoCache();
      await expect(noCache.run('x')).resolves.toBe('ok-x');

      class Throwing {
        public cacheService = { get: jest.fn(), set: jest.fn() };

        @CacheWrite({ strategy: 'write-through', key: 'k-{0}', ttl: 5 })
        async run() {
          throw new Error('boom');
        }
      }

      const t = new Throwing();
      await expect(t.run()).rejects.toThrow('boom');
    });
  });

  describe('CacheWarm decorators', () => {
    it('registers jobs, warms cache, lists/removes jobs, and supports metadata', async () => {
      process.env.NODE_ENV = 'development';
      const set = jest.fn().mockResolvedValue(undefined);

      class WarmService {
        public cacheService = { get: jest.fn(), set };
        public prefix = 'p';

        @CacheWarm({
          keys: ['a', 'b'],
          fetcher: async function (this: WarmService, key: string) {
            return `${this.prefix}-${key}`;
          },
          ttl: 22,
          parallel: false,
          condition: 'development',
        })
        async run() {
          return 'ran';
        }
      }

      const svc = new WarmService();
      await expect(svc.run()).resolves.toBe('ran');
      expect(hasCacheWarmMetadata(WarmService.prototype, 'run')).toBe(true);
      expect(getCacheWarmMetadata(WarmService.prototype, 'run')?.ttl).toBe(22);

      const jobs = CacheWarmingUtils.listJobs();
      expect(jobs).toContain('WarmService.run');
      await CacheWarmingUtils.warmUp('WarmService.run');
      expect(set).toHaveBeenCalledWith('a', 'p-a', 22);
      expect(set).toHaveBeenCalledWith('b', 'p-b', 22);

      CacheWarmingUtils.removeJob('WarmService.run');
      expect(CacheWarmingUtils.listJobs()).not.toContain('WarmService.run');
    });

    it('covers cron schedule, invalid schedule, standard decorator signature, and unknown condition', async () => {
      cron.validate.mockReturnValue(true);
      const set = jest.fn().mockResolvedValue(undefined);

      class ScheduledWarmService {
        public cacheService = { get: jest.fn(), set };

        @CacheWarm({
          keys: ['x'],
          fetcher: async (k) => k,
          schedule: '*/5 * * * *',
          condition: 'unknown-condition',
        })
        async run() {
          return 'ok';
        }
      }

      const s = new ScheduledWarmService();
      await s.run();
      expect(cron.schedule).toHaveBeenCalled();
      const scheduledTask = cron.schedule.mock.results[0]?.value as { start: jest.Mock };
      expect(scheduledTask.start).toHaveBeenCalled();

      cron.validate.mockReturnValue(false);
      class InvalidScheduleService {
        @CacheWarm({ keys: ['x'], fetcher: async () => 'x', schedule: 'invalid' })
        async run() {
          return 'nope';
        }
      }
      await new InvalidScheduleService().run();
      expect(cron.schedule).toHaveBeenCalledTimes(1);

      const wrapped = CacheWarm({ keys: ['k'], fetcher: async () => 'v' })(
        async function () {
          return 'std';
        },
        { kind: 'method', name: 'stdMethod' } as unknown as ClassMethodDecoratorContext
      ) as (...args: unknown[]) => Promise<unknown>;

      await expect(
        wrapped.call({
          cacheService: { set: jest.fn().mockResolvedValue(undefined), get: jest.fn() },
        })
      ).resolves.toBe('std');
    });

    it('supports builder path and graceful behavior when cache service is absent', async () => {
      class WarmBuilderService {
        @CacheWarmBuilder({ keys: ['id'], fetcher: async () => 'value', ttl: 5 })
        async run() {
          return true;
        }
      }
      const svc = new WarmBuilderService();
      await svc.run();
      const [jobId] = CacheWarmingUtils.listJobs();
      await expect(CacheWarmingUtils.warmUp(jobId)).resolves.toBeUndefined();
    });
  });

  describe('CacheLock decorators', () => {
    it('stores metadata and supports builder', () => {
      class LockService {
        @CacheLock({ key: 'k-{0}', ttl: 11 })
        async lockA(_id: string) {
          return true;
        }

        @CacheLockBuilder({ ttl: 20 })
        async lockB() {
          return true;
        }
      }

      expect(getCacheLockMetadata(LockService.prototype, 'lockA')?.ttl).toBe(11);
      expect(hasCacheLockMetadata(LockService.prototype, 'lockA')).toBe(true);
      expect(getCacheLockMetadata(LockService.prototype, 'lockB')?.key).toContain(
        'lockservice-lockB'
      );
    });
  });

  describe('Distributed lock strategies', () => {
    it('covers redis lock acquire/release/isLocked success and failure paths', async () => {
      const redis = {
        set: jest.fn().mockResolvedValue('OK'),
        eval: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(1),
      };
      const lock = new RedisDistributedLock(redis);

      await expect(lock.acquire('a', 100)).resolves.toBe(true);
      await expect(lock.isLocked('a')).resolves.toBe(true);
      await expect(lock.release('a')).resolves.toBe(true);

      redis.set.mockResolvedValueOnce(null);
      await expect(lock.acquire('b', 100)).resolves.toBe(false);

      redis.exists.mockRejectedValueOnce(new Error('exists down'));
      await expect(lock.isLocked('c')).resolves.toBe(false);

      redis.eval.mockRejectedValueOnce(new Error('eval down'));
      await expect(lock.release('d')).resolves.toBe(false);
    });

    it('covers memory lock lifecycle and cleanup', async () => {
      jest.useFakeTimers();
      const lock = new MemoryDistributedLock(10);

      await expect(lock.acquire('x', 20)).resolves.toBe(true);
      await expect(lock.acquire('x', 20)).resolves.toBe(false);
      await expect(lock.isLocked('x')).resolves.toBe(true);

      jest.advanceTimersByTime(30);
      await expect(lock.isLocked('x')).resolves.toBe(false);

      await lock.acquire('y', 1000);
      await expect(lock.release('y')).resolves.toBe(true);
      lock.destroy();
    });

    it('covers lock manager retry events, success and failure', async () => {
      const fakeLock = {
        acquire: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
        release: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(),
      };
      const manager = new LockManager(fakeLock);
      const retry = jest.fn();
      manager.on('lock-retry', retry);

      const result = await manager.withLock('k', async () => 'done', {
        retryDelay: 1,
        maxRetries: 2,
      });
      expect(result).toBe('done');
      expect(retry).toHaveBeenCalled();

      const alwaysFail = new LockManager({
        acquire: jest.fn().mockResolvedValue(false),
        release: jest.fn().mockResolvedValue(true),
        isLocked: jest.fn(),
      });

      await expect(
        alwaysFail.withLock('x', async () => 'no', { retryDelay: 1, maxRetries: 1 })
      ).rejects.toThrow('Failed to acquire lock after 1 attempts: x');
    });
  });
});
