/**
 * Worker bootstrap script - runs inside worker threads.
 * Must NOT import @hazeljs/core or any app-specific code.
 * Only uses node:worker_threads and require() for task handlers.
 */

import { parentPort, workerData } from 'node:worker_threads';
import path from 'node:path';

interface WorkerBootstrapData {
  taskRegistry: Record<string, string>;
  defaultTimeout: number;
}

interface RunMessage {
  type: 'run';
  id: string;
  taskName: string;
  payload: unknown;
  timeout?: number;
}

function isRunMessage(msg: unknown): msg is RunMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as RunMessage).type === 'run' &&
    typeof (msg as RunMessage).id === 'string' &&
    typeof (msg as RunMessage).taskName === 'string'
  );
}

function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Task timed out after ${ms}ms`));
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function executeTask(
  taskName: string,
  payload: unknown,
  taskRegistry: Record<string, string>,
  timeoutMs: number
): Promise<unknown> {
  const handlerPath = taskRegistry[taskName];
  if (!handlerPath) {
    throw new Error(`Task not found: ${taskName}`);
  }

  const resolvedPath = path.isAbsolute(handlerPath) ? handlerPath : path.resolve(handlerPath);
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional: dynamic load in worker
  const mod = require(resolvedPath);
  const HandlerClass = mod.default ?? mod;
  if (typeof HandlerClass !== 'function') {
    throw new Error(`Task handler for "${taskName}" does not export a class or function`);
  }

  const instance = new HandlerClass();
  if (typeof instance.run !== 'function') {
    throw new Error(`Task handler for "${taskName}" has no run(payload) method`);
  }

  const result = await runWithTimeout(Promise.resolve(instance.run(payload)), timeoutMs);
  return result;
}

function main(): void {
  const data = workerData as WorkerBootstrapData;
  const { taskRegistry, defaultTimeout } = data;

  if (!taskRegistry || typeof taskRegistry !== 'object') {
    throw new Error('Worker bootstrap: taskRegistry is required in workerData');
  }

  const timeout = typeof defaultTimeout === 'number' && defaultTimeout > 0 ? defaultTimeout : 30000;

  parentPort?.on('message', (message: unknown) => {
    if (!isRunMessage(message)) return;

    const { id, taskName, payload, timeout: msgTimeout } = message;
    const taskTimeout = typeof msgTimeout === 'number' && msgTimeout > 0 ? msgTimeout : timeout;

    const startMs = Date.now();
    executeTask(taskName, payload, taskRegistry, taskTimeout)
      .then((result) => {
        const durationMs = Date.now() - startMs;
        parentPort?.postMessage({
          type: 'result',
          id,
          result,
          durationMs,
        });
      })
      .catch((err: Error) => {
        parentPort?.postMessage({
          type: 'error',
          id,
          error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
          },
        });
      });
  });
}

main();
