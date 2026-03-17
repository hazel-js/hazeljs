/// <reference types="jest" />

jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Injectable: () => () => undefined,
  Service: () => () => undefined,
  Inject: () => () => undefined,
  HazelModule: () => () => undefined,
  Container: { getInstance: jest.fn() },
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const createMockWorker = () => {
  let messageHandler: (msg: unknown) => void;
  let errorHandler: (err: Error) => void;
  let exitHandler: (code: number) => void;
  return {
    postMessage: jest.fn((msg: { id: string; taskName: string }) => {
      setImmediate(() => {
        if (messageHandler) {
          messageHandler({
            type: 'result',
            id: msg.id,
            result: 'ok',
            durationMs: 10,
          });
        }
      });
    }),
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') messageHandler = handler;
      else if (event === 'error') errorHandler = handler;
      else if (event === 'exit') exitHandler = handler;
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
    _triggerError: (err: Error) => errorHandler?.(err),
    _triggerExit: (code: number) => exitHandler?.(code),
  };
};

const mockWorkers: ReturnType<typeof createMockWorker>[] = [];
jest.mock('node:worker_threads', () => ({
  Worker: jest.fn(() => {
    const w = createMockWorker();
    mockWorkers.push(w);
    return w;
  }),
}));

const originalProcessOn = process.once.bind(process);
beforeAll(() => {
  (process as any).once = jest.fn((sig: string, handler: () => void) => {
    if (sig === 'SIGTERM' || sig === 'SIGINT') return process;
    return originalProcessOn(sig, handler);
  });
});

afterAll(() => {
  (process as any).once = originalProcessOn;
});

import path from 'path';
import { WorkerPoolManager, getDefaultPoolSize } from './worker.pool';
import { WorkerRegistry } from './worker.registry';
import { WorkerTaskTimeoutError } from './worker.errors';

describe('WorkerPoolManager', () => {
  let registry: WorkerRegistry;
  let pool: WorkerPoolManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkers.length = 0;
    registry = new WorkerRegistry();
    registry.register({ name: 'test-task', handlerPath: '/fake/path.js' });
    pool = new WorkerPoolManager(registry, {
      poolSize: 2,
      defaultTimeout: 5000,
      bootstrapPath: path.join(__dirname, 'worker-bootstrap.js'),
      gracefulShutdownTimeout: 5000,
    });
  });

  it('start() populates workers and sets taskRegistry', async () => {
    await pool.start();
    expect(pool.getPoolSize()).toBe(2);
    expect(mockWorkers).toHaveLength(2);
  });

  it('start() is idempotent', async () => {
    await pool.start();
    await pool.start();
    expect(pool.getPoolSize()).toBe(2);
  });

  it('execute() returns result from worker', async () => {
    await pool.start();
    const result = await pool.execute('test-task', { data: 1 });
    expect(result.type).toBe('result');
    if (result.type === 'result') {
      expect(result.result).toBe('ok');
      expect(result.durationMs).toBe(10);
    }
  });

  it('execute() rejects when pool is shutting down', async () => {
    await pool.start();
    await pool.shutdown();
    await expect(pool.execute('test-task', {})).rejects.toThrow('shutting down');
  });

  it('execute() rejects when no workers', async () => {
    await expect(pool.execute('test-task', {})).rejects.toThrow('no workers');
  });

  it('execute() rejects on timeout', async () => {
    await pool.start();
    mockWorkers[0].postMessage.mockImplementation(() => {
      // Never call messageHandler - simulate timeout
    });
    const promise = pool.execute('test-task', {}, 10);
    await expect(promise).rejects.toThrow(WorkerTaskTimeoutError);
    await expect(promise).rejects.toThrow('timed out');
  });

  it('shutdown() terminates workers and clears pending', async () => {
    await pool.start();
    await pool.shutdown();
    expect(mockWorkers[0].terminate).toHaveBeenCalled();
    expect(mockWorkers[1].terminate).toHaveBeenCalled();
    expect(pool.getPoolSize()).toBe(0);
  });

  it('shutdown() is idempotent', async () => {
    await pool.start();
    await pool.shutdown();
    await pool.shutdown();
    expect(mockWorkers[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('getNextWorker round-robins across workers', async () => {
    await pool.start();
    const p1 = pool.execute('test-task', {});
    const p2 = pool.execute('test-task', {});
    await Promise.all([p1, p2]);
    expect(mockWorkers[0].postMessage).toHaveBeenCalled();
    expect(mockWorkers[1].postMessage).toHaveBeenCalled();
  });
});

describe('getDefaultPoolSize', () => {
  it('returns at least 1', () => {
    expect(getDefaultPoolSize()).toBeGreaterThanOrEqual(1);
  });
});
