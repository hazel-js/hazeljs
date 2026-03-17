import { Worker } from 'node:worker_threads';
import path from 'node:path';
import os from 'node:os';
import type { WorkerPoolOptions } from './worker.types';
import type { WorkerRunMessage, WorkerResponseMessage } from './worker.types';
import { WorkerTaskTimeoutError } from './worker.errors';
import type { WorkerRegistry } from './worker.registry';
import logger from '@hazeljs/core';

interface PendingTask {
  resolve: (value: WorkerResponseMessage) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class WorkerPoolManager {
  private workers: Worker[] = [];
  private workerIndex = 0;
  private pending = new Map<string, PendingTask>();
  private isShuttingDown = false;
  private options: WorkerPoolOptions;
  private taskRegistry: Record<string, string> = {};
  private started = false;

  constructor(
    private readonly registry: WorkerRegistry,
    options: WorkerPoolOptions
  ) {
    this.options = options;
  }

  /**
   * Initialize the worker pool. Must be called after registry is populated.
   */
  async start(): Promise<void> {
    if (this.started) return;

    this.taskRegistry = this.registry.toWorkerData();
    if (Object.keys(this.taskRegistry).length === 0) {
      logger.warn('Worker pool started with no tasks registered');
    }

    const { poolSize, defaultTimeout, bootstrapPath, gracefulShutdownTimeout } = this.options;

    const resolvedBootstrap = path.isAbsolute(bootstrapPath)
      ? bootstrapPath
      : path.resolve(bootstrapPath);

    const workerData = {
      taskRegistry: this.taskRegistry,
      defaultTimeout,
    };

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(resolvedBootstrap, {
        workerData,
        execArgv: [],
      });

      worker.on('message', (msg: WorkerResponseMessage) => this.handleMessage(msg));
      worker.on('error', (err) => this.handleWorkerError(err));
      worker.on('exit', (code) => this.handleWorkerExit(code, i));

      this.workers.push(worker);
    }

    this.started = true;
    this.setupShutdownHandlers(gracefulShutdownTimeout);
    logger.info(`Worker pool started with ${poolSize} workers`);
  }

  /**
   * Execute a task on an available worker
   */
  execute(taskName: string, payload: unknown, timeoutMs?: number): Promise<WorkerResponseMessage> {
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down'));
    }

    if (this.workers.length === 0) {
      return Promise.reject(new Error('Worker pool has no workers'));
    }

    return new Promise((resolve, reject) => {
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const effectiveTimeout = timeoutMs ?? this.options.defaultTimeout;

      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new WorkerTaskTimeoutError(taskName, effectiveTimeout));
        }
      }, effectiveTimeout);

      this.pending.set(id, { resolve, reject, timeoutId });

      const worker = this.getNextWorker();
      const message: WorkerRunMessage = {
        type: 'run',
        id,
        taskName,
        payload,
        timeout: effectiveTimeout,
      };

      worker.postMessage(message);
    });
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down worker pool...');

    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Worker pool shutting down'));
    }
    this.pending.clear();

    await Promise.all(
      this.workers.map(
        (w) =>
          new Promise<void>((resolve) => {
            w.terminate()
              .then(() => resolve())
              .catch(() => resolve());
          })
      )
    );
    this.workers = [];
    logger.info('Worker pool shut down');
  }

  /**
   * Get pool size
   */
  getPoolSize(): number {
    return this.workers.length;
  }

  private getNextWorker(): Worker {
    const idx = this.workerIndex % this.workers.length;
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return this.workers[idx];
  }

  private handleMessage(msg: WorkerResponseMessage): void {
    const pending = this.pending.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pending.delete(msg.id);
    pending.resolve(msg);
  }

  private handleWorkerError(err: Error): void {
    logger.error('Worker error:', err);
  }

  private handleWorkerExit(code: number, index: number): void {
    if (code !== 0 && !this.isShuttingDown) {
      logger.warn(`Worker ${index} exited with code ${code}`);
    }
  }

  private setupShutdownHandlers(gracefulShutdownTimeout: number): void {
    const shutdown = async (): Promise<void> => {
      const timer = setTimeout(() => {
        logger.warn('Worker pool shutdown timeout exceeded');
        process.exit(1);
      }, gracefulShutdownTimeout);

      await this.shutdown();
      clearTimeout(timer);
      process.exit(0);
    };

    process.once('SIGTERM', () => {
      shutdown().catch((err) => {
        logger.error('Worker pool shutdown error:', err);
        process.exit(1);
      });
    });
    process.once('SIGINT', () => {
      shutdown().catch((err) => {
        logger.error('Worker pool shutdown error:', err);
        process.exit(1);
      });
    });
  }
}

/**
 * Get default pool size based on CPU count
 */
export function getDefaultPoolSize(): number {
  const cpus = os.cpus().length;
  return Math.max(1, cpus - 1);
}
