import { RedisLockBackend } from './redis-backend';

describe('RedisLockBackend', () => {
  let backend: RedisLockBackend;
  let redis: any;

  beforeEach(() => {
    redis = {
      set: jest.fn(),
      eval: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    backend = new RedisLockBackend(redis);
  });

  /*afterEach(async () => {
    await backend.close();
  });*/

  it('should acquire a lock', async () => {
    redis.set.mockResolvedValue('OK');

    const lock = await backend.acquire({ key: 'test-lock', ttl: 1000 });

    expect(lock).not.toBeNull();
    expect(redis.set).toHaveBeenCalledWith('test-lock', expect.any(String), 'PX', 1000, 'NX');
  });

  it('should return null if lock acquisition fails', async () => {
    redis.set.mockResolvedValue(null);

    const lock = await backend.acquire({ key: 'test-lock', ttl: 1000 });

    expect(lock).toBeNull();
  });

  it('should release a lock using eval', async () => {
    redis.set.mockResolvedValue('OK');
    const lock = await backend.acquire({ key: 'test-lock', ttl: 1000 });

    await lock?.release();

    expect(redis.eval).toHaveBeenCalled();
  });

  it('should extend a lock using eval', async () => {
    redis.set.mockResolvedValue('OK');
    const lock = await backend.acquire({ key: 'test-lock', ttl: 1000 });

    redis.eval.mockResolvedValue(1);
    const extended = await lock?.extend(2000);

    expect(extended).toBe(true);
    expect(redis.eval).toHaveBeenCalled();
  });
});
