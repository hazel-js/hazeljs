import { LockManager } from './lock-manager';

describe('LockManager (Memory)', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = LockManager.getInstance();
  });

  afterEach(async () => {
    await lockManager.close();
  });

  it('should acquire and release a lock', async () => {
    const lock = await lockManager.acquire({ key: 'test-lock', ttl: 1000 });
    expect(lock).toBeDefined();
    expect(lock).not.toBeNull();

    if (lock) {
      const secondLock = await lockManager.acquire({ key: 'test-lock', ttl: 1000 });
      expect(secondLock).toBeNull();

      await lock.release();

      const thirdLock = await lockManager.acquire({ key: 'test-lock', ttl: 1000 });
      expect(thirdLock).not.toBeNull();
      await thirdLock?.release();
    }
  });

  it('should retry to acquire a lock', async () => {
    const lock = await lockManager.acquire({ key: 'retry-lock', ttl: 500 });
    expect(lock).not.toBeNull();

    // Release after 200ms
    setTimeout(() => lock?.release(), 200);

    const secondLock = await lockManager.acquire({
      key: 'retry-lock',
      ttl: 500,
      retry: { attempts: 3, delay: 100 },
    });

    expect(secondLock).not.toBeNull();
    await secondLock?.release();
  });

  it('should fail after max retries', async () => {
    const lock = await lockManager.acquire({ key: 'fail-lock', ttl: 1000 });
    expect(lock).not.toBeNull();

    const startTime = Date.now();
    const secondLock = await lockManager.acquire({
      key: 'fail-lock',
      ttl: 500,
      retry: { attempts: 2, delay: 100 },
    });

    const duration = Date.now() - startTime;
    expect(secondLock).toBeNull();
    expect(duration).toBeGreaterThanOrEqual(190);

    await lock?.release();
  });

  it('should register a new backend', async () => {
    const mockBackend = {
      acquire: jest.fn().mockResolvedValue({ release: jest.fn() }),
      release: jest.fn(),
      extend: jest.fn(),
    };
    lockManager.registerBackend('mock', mockBackend);

    await lockManager.acquire({ key: 'test', backend: 'mock' });
    expect(mockBackend.acquire).toHaveBeenCalled();
  });

  it('should throw error if backend is not found', async () => {
    await expect(lockManager.acquire({ key: 'test', backend: 'non-existent' })).rejects.toThrow(
      "Lock backend 'non-existent' not found"
    );
  });

  it('should change default backend', async () => {
    const mockBackend = {
      acquire: jest.fn().mockResolvedValue({ release: jest.fn() }),
      release: jest.fn(),
      extend: jest.fn(),
    };
    lockManager.registerBackend('mock-default', mockBackend);
    lockManager.setDefaultBackend('mock-default');

    await lockManager.acquire({ key: 'test' });
    expect(mockBackend.acquire).toHaveBeenCalled();

    // Reset back to memory for other tests
    lockManager.setDefaultBackend('memory');
  });

  it('should throw error if setting non-existent default backend', () => {
    expect(() => lockManager.setDefaultBackend('ghost')).toThrow(
      "Backend 'ghost' is not registered."
    );
  });

  it('should setup redis backend', () => {
    // We don't need a real redis for this check, just that it registers
    lockManager.setupRedis('redis://localhost:6379');
    // It should now have a 'redis' backend
    expect((lockManager as any).backends.has('redis')).toBe(true);
  });
});
