import 'reflect-metadata';
import { DistributedLock } from './distributed-lock.decorator';
import { LockManager } from './lock-manager';

class TestService {
  @DistributedLock({ key: 'test-lock-{id}', ttl: 5000 })
  async doSomething(id: number) {
    return `done-${id}`;
  }

  @DistributedLock({ key: 'nested-lock-{data.userId}', ttl: 5000 })
  async doNested(data: { userId: string; name: string }) {
    return `done-${data.userId}`;
  }

  @DistributedLock({ key: 'no-params-lock', ttl: 5000 })
  async doNoParams() {
    return 'done';
  }
}

describe('DistributedLock Decorator', () => {
  let lockManager: LockManager;
  let service: TestService;

  beforeEach(() => {
    lockManager = LockManager.getInstance();
    service = new TestService();
  });

  afterEach(async () => {
    await lockManager.close();
  });

  it('should acquire and release lock for simple param', async () => {
    const acquireSpy = jest.spyOn(lockManager, 'acquire');

    const result = await service.doSomething(123);

    expect(result).toBe('done-123');
    expect(acquireSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'test-lock-123',
      })
    );
  });

  it('should acquire and release lock for nested param', async () => {
    const acquireSpy = jest.spyOn(lockManager, 'acquire');

    const result = await service.doNested({ userId: 'u1', name: 'John' });

    expect(result).toBe('done-u1');
    expect(acquireSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'nested-lock-u1',
      })
    );
  });

  it('should block concurrent calls for same key', async () => {
    // Manually acquire lock
    await lockManager.acquire({ key: 'no-params-lock', ttl: 5000 });

    await expect(service.doNoParams()).rejects.toThrow(
      'Could not acquire distributed lock for key: no-params-lock'
    );
  });

  it('should handle complex key resolution from object', async () => {
    const acquireSpy = jest.spyOn(lockManager, 'acquire');

    class TestClass {
      @DistributedLock({ key: 'user-{user.id}-session-{session.token}' })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async execute(user: any, session: any) {
        return 'executed';
      }
    }

    const instance = new TestClass();
    const result = await instance.execute({ id: '1' }, { token: 'abc' });

    expect(result).toBe('executed');
    expect(acquireSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'user-1-session-abc',
      })
    );
  });

  it('should handle missing keys gracefully', async () => {
    const acquireSpy = jest.spyOn(lockManager, 'acquire');

    class TestClass {
      @DistributedLock({ key: 'test-{missing}' })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async execute(data: any) {
        return 'executed';
      }
    }

    const instance = new TestClass();
    await instance.execute({ id: '1' });

    expect(acquireSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'test-{missing}', // placeholder remains if not found
      })
    );
  });
});
