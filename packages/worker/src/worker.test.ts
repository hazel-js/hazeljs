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

import { WorkerTask, getWorkerTaskMetadata, WORKER_TASK_METADATA_KEY } from './worker.decorator';
import { WorkerRegistry } from './worker.registry';
import { WorkerSerializer } from './worker.serializer';
import {
  WorkerTaskNotFoundError,
  WorkerTaskTimeoutError,
  WorkerExecutionFailedError,
  WorkerSerializationError,
  WorkerPoolExhaustedError,
} from './worker.errors';
import { WorkerExecutor } from './worker.executor';
import { WorkerModule } from './worker.module';
import { getDefaultPoolSize } from './worker.pool';
import os from 'os';

describe('WorkerTask decorator', () => {
  it('attaches metadata to the class', () => {
    @WorkerTask({ name: 'test-task', timeout: 5000 })
    class TestTask {
      run(_payload: unknown) {
        return 'ok';
      }
    }

    const metadata = Reflect.getMetadata(WORKER_TASK_METADATA_KEY, TestTask);
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe('test-task');
    expect(metadata.timeout).toBe(5000);
  });

  it('stores maxConcurrency when provided', () => {
    @WorkerTask({ name: 'concurrent-task', maxConcurrency: 4 })
    class ConcurrentTask {
      run(_payload: unknown) {
        return 'ok';
      }
    }

    const metadata = getWorkerTaskMetadata(ConcurrentTask);
    expect(metadata?.maxConcurrency).toBe(4);
  });

  it('getWorkerTaskMetadata returns undefined for class without decorator', () => {
    class PlainTask {
      run(_payload: unknown) {
        return 'ok';
      }
    }

    expect(getWorkerTaskMetadata(PlainTask)).toBeUndefined();
  });

  it('getWorkerTaskMetadata works with instance', () => {
    @WorkerTask({ name: 'instance-task' })
    class InstanceTask {
      run(_payload: unknown) {
        return 'ok';
      }
    }

    const instance = new InstanceTask();
    const metadata = getWorkerTaskMetadata(instance);
    expect(metadata?.name).toBe('instance-task');
  });
});

describe('WorkerRegistry', () => {
  let registry: WorkerRegistry;

  beforeEach(() => {
    registry = new WorkerRegistry();
  });

  it('registers and retrieves task definition', () => {
    registry.register({
      name: 'my-task',
      handlerPath: '/path/to/handler.js',
      timeout: 10000,
    });

    const def = registry.get('my-task');
    expect(def.name).toBe('my-task');
    expect(def.handlerPath).toBe('/path/to/handler.js');
    expect(def.timeout).toBe(10000);
  });

  it('throws WorkerTaskNotFoundError for unknown task', () => {
    expect(() => registry.get('unknown')).toThrow(WorkerTaskNotFoundError);
    expect(() => registry.get('unknown')).toThrow('Worker task not found: unknown');
  });

  it('has returns true for registered task', () => {
    registry.register({ name: 'task-a', handlerPath: '/a.js' });
    expect(registry.has('task-a')).toBe(true);
    expect(registry.has('task-b')).toBe(false);
  });

  it('registerFromMap registers multiple tasks', () => {
    registry.registerFromMap(
      {
        'task-1': '/path/1.js',
        'task-2': '/path/2.js',
      },
      { timeout: 5000 }
    );

    expect(registry.get('task-1').handlerPath).toContain('/path/1.js');
    expect(registry.get('task-1').timeout).toBe(5000);
    expect(registry.getTaskNames()).toHaveLength(2);
  });

  it('registerFromDirectory registers by convention', () => {
    registry.registerFromDirectory('/tasks', ['embed', 'parse'], { timeout: 3000 });

    expect(registry.get('embed').handlerPath).toContain('embed.js');
    expect(registry.get('parse').handlerPath).toContain('parse.js');
    expect(registry.get('embed').timeout).toBe(3000);
  });

  it('toWorkerData returns name to path map', () => {
    registry.register({ name: 'x', handlerPath: '/x.js' });
    const data = registry.toWorkerData();
    expect(data).toEqual({ x: '/x.js' });
  });

  it('clear removes all registrations', () => {
    registry.register({ name: 't', handlerPath: '/t.js' });
    registry.clear();
    expect(registry.has('t')).toBe(false);
    expect(() => registry.get('t')).toThrow(WorkerTaskNotFoundError);
  });

  it('getAll returns all task definitions', () => {
    registry.register({ name: 'a', handlerPath: '/a.js' });
    registry.register({ name: 'b', handlerPath: '/b.js' });
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((d) => d.name)).toContain('a');
    expect(all.map((d) => d.name)).toContain('b');
  });
});

describe('WorkerSerializer', () => {
  let serializer: WorkerSerializer;

  beforeEach(() => {
    serializer = new WorkerSerializer();
  });

  it('serializes and deserializes payload', () => {
    const payload = { text: ['hello'], count: 42 };
    const str = serializer.serialize(payload);
    expect(typeof str).toBe('string');
    const restored = serializer.deserialize<typeof payload>(str);
    expect(restored).toEqual(payload);
  });

  it('throws WorkerSerializationError for non-serializable payload', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => serializer.serialize(circular)).toThrow(WorkerSerializationError);
  });

  it('throws WorkerSerializationError for invalid JSON', () => {
    expect(() => serializer.deserialize('not json {')).toThrow(WorkerSerializationError);
  });

  it('handles non-Error in serialize catch', () => {
    const badObj = {
      toJSON() {
        throw 'string error';
      },
    };
    expect(() => serializer.serialize(badObj)).toThrow(WorkerSerializationError);
  });

  it('handles non-Error in deserialize catch', () => {
    const badParse = () => {
      throw { notAnError: true };
    };
    jest.spyOn(JSON, 'parse').mockImplementationOnce(badParse);
    expect(() => serializer.deserialize('{}')).toThrow(WorkerSerializationError);
    jest.restoreAllMocks();
  });
});

describe('WorkerExecutor', () => {
  it('execute returns result from pool', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue({
        type: 'result',
        id: '1',
        result: { embeddings: [0.1, 0.2] },
        durationMs: 50,
      }),
    };

    const registry = new WorkerRegistry();
    registry.register({ name: 'embed', handlerPath: '/embed.js' });

    const executor = new WorkerExecutor(registry, mockPool as never);

    const result = await executor.execute<{ embeddings: number[] }>('embed', { text: ['hi'] });

    expect(result.result).toEqual({ embeddings: [0.1, 0.2] });
    expect(result.durationMs).toBe(50);
    expect(mockPool.execute).toHaveBeenCalledWith('embed', { text: ['hi'] }, undefined);
  });

  it('execute throws WorkerExecutionFailedError when worker returns error', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue({
        type: 'error',
        id: '1',
        error: { message: 'Task failed', stack: '...', name: 'Error' },
      }),
    };

    const registry = new WorkerRegistry();
    registry.register({ name: 'fail-task', handlerPath: '/fail.js' });

    const executor = new WorkerExecutor(registry, mockPool as never);

    await expect(executor.execute('fail-task', {})).rejects.toThrow(WorkerExecutionFailedError);
    await expect(executor.execute('fail-task', {})).rejects.toThrow('Task failed');
  });

  it('execute passes timeout option', async () => {
    const mockPool = {
      execute: jest.fn().mockResolvedValue({
        type: 'result',
        id: '1',
        result: 'ok',
        durationMs: 10,
      }),
    };

    const registry = new WorkerRegistry();
    registry.register({ name: 'task', handlerPath: '/t.js', timeout: 5000 });

    const executor = new WorkerExecutor(registry, mockPool as never);
    await executor.execute('task', {}, { timeout: 2000 });

    expect(mockPool.execute).toHaveBeenCalledWith('task', {}, 2000);
  });

  it('hasTask and getTaskNames work', () => {
    const registry = new WorkerRegistry();
    registry.register({ name: 'a', handlerPath: '/a.js' });
    registry.register({ name: 'b', handlerPath: '/b.js' });

    const executor = new WorkerExecutor(registry, {} as never);

    expect(executor.hasTask('a')).toBe(true);
    expect(executor.hasTask('c')).toBe(false);
    expect(executor.getTaskNames()).toEqual(['a', 'b']);
  });
});

describe('WorkerModule', () => {
  describe('forRoot', () => {
    it('returns DynamicModule with providers', () => {
      const result = WorkerModule.forRoot({
        taskRegistry: { test: '/path/to/task.js' },
      });

      expect(result.module).toBe(WorkerModule);
      expect(result.providers).toBeDefined();
      expect(result.providers).toContain(WorkerRegistry);
      expect(result.providers).toContain(WorkerExecutor);
      expect(result.global).toBe(true);
    });

    it('respects isGlobal: false', () => {
      const result = WorkerModule.forRoot({ isGlobal: false });
      expect(result.global).toBe(false);
    });
  });

  describe('forRootAsync', () => {
    it('resolves options and returns DynamicModule', async () => {
      const result = await WorkerModule.forRootAsync(() =>
        Promise.resolve({ taskRegistry: { x: '/x.js' } })
      );

      expect(result.module).toBe(WorkerModule);
      expect(result.providers).toBeDefined();
    });

    it('accepts synchronous options factory', async () => {
      const result = await WorkerModule.forRootAsync(() => ({
        taskRegistry: { y: '/y.js' },
      }));

      expect(result.module).toBe(WorkerModule);
    });
  });

  describe('forRoot options', () => {
    it('creates WorkerPoolManager via useFactory', () => {
      const result = WorkerModule.forRoot({
        taskRegistry: { t: '/t.js' },
        poolSize: 2,
      });
      const factoryProvider = result.providers?.find(
        (p): p is { useFactory: (r: WorkerRegistry) => unknown; inject: unknown[] } =>
          typeof p === 'object' && p !== null && 'useFactory' in p && 'inject' in p
      );
      expect(factoryProvider).toBeDefined();
      const registry = new WorkerRegistry();
      registry.register({ name: 't', handlerPath: '/t.js' });
      const pool = factoryProvider?.useFactory(registry);
      expect(pool).toBeDefined();
      expect((pool as { constructor?: { name?: string } })?.constructor?.name).toBe(
        'WorkerPoolManager'
      );
    });
  });
});

describe('getDefaultPoolSize', () => {
  it('returns at least 1', () => {
    const size = getDefaultPoolSize();
    expect(size).toBeGreaterThanOrEqual(1);
  });

  it('returns reasonable value based on CPUs', () => {
    const cpus = os.cpus().length;
    const expected = Math.max(1, cpus - 1);
    expect(getDefaultPoolSize()).toBe(expected);
  });
});

describe('Error classes', () => {
  it('WorkerTaskNotFoundError has correct name and message', () => {
    const err = new WorkerTaskNotFoundError('missing');
    expect(err.name).toBe('WorkerTaskNotFoundError');
    expect(err.message).toContain('missing');
  });

  it('WorkerTaskTimeoutError has correct name and message', () => {
    const err = new WorkerTaskTimeoutError('slow', 5000);
    expect(err.name).toBe('WorkerTaskTimeoutError');
    expect(err.message).toContain('5000');
  });

  it('WorkerExecutionFailedError preserves cause', () => {
    const cause = new Error('underlying');
    const err = new WorkerExecutionFailedError('task', cause);
    expect(err.cause).toBe(cause);
    expect(err.message).toContain('underlying');
  });

  it('WorkerSerializationError preserves cause', () => {
    const cause = new Error('parse error');
    const err = new WorkerSerializationError('failed', cause);
    expect(err.cause).toBe(cause);
  });

  it('WorkerPoolExhaustedError has default message', () => {
    const err = new WorkerPoolExhaustedError();
    expect(err.name).toBe('WorkerPoolExhaustedError');
    expect(err.message).toContain('exhausted');
  });

  it('WorkerPoolExhaustedError accepts custom message', () => {
    const err = new WorkerPoolExhaustedError('custom message');
    expect(err.message).toBe('custom message');
  });

  it('WorkerExecutionFailedError works without cause', () => {
    const err = new WorkerExecutionFailedError('task-name');
    expect(err.name).toBe('WorkerExecutionFailedError');
    expect(err.message).toContain('task-name');
    expect(err.cause).toBeUndefined();
  });
});
