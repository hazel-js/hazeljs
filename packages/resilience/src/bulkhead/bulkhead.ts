/**
 * Bulkhead
 * Concurrency limiter that isolates failures by limiting
 * the number of concurrent calls and queue depth.
 */

import { BulkheadConfig, BulkheadError, BulkheadMetrics } from '../types';

interface QueuedCall {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

export class Bulkhead {
  private activeCalls = 0;
  private queue: QueuedCall[] = [];
  private rejectedCount = 0;
  private maxConcurrent: number;
  private maxQueue: number;
  private queueTimeout: number;

  constructor(config: BulkheadConfig) {
    this.maxConcurrent = config.maxConcurrent;
    this.maxQueue = config.maxQueue;
    this.queueTimeout = config.queueTimeout ?? 0; // 0 = no timeout
  }

  /**
   * Execute a function within the bulkhead constraints
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquirePermit();

    try {
      return await fn();
    } finally {
      this.releasePermit();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): BulkheadMetrics {
    return {
      activeCalls: this.activeCalls,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
      rejectedCount: this.rejectedCount,
    };
  }

  /**
   * Get the number of currently active calls
   */
  getActiveCalls(): number {
    return this.activeCalls;
  }

  /**
   * Get the number of calls waiting in the queue
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  // ─── Internal ───

  private async acquirePermit(): Promise<void> {
    // If there's capacity, immediately grant
    if (this.activeCalls < this.maxConcurrent) {
      this.activeCalls++;
      return;
    }

    // If the queue is full, reject immediately
    if (this.queue.length >= this.maxQueue) {
      this.rejectedCount++;
      throw new BulkheadError(
        `Bulkhead capacity exceeded: ${this.activeCalls}/${this.maxConcurrent} active, ${this.queue.length}/${this.maxQueue} queued`
      );
    }

    // Enqueue and wait
    return new Promise<void>((resolve, reject) => {
      const queuedCall: QueuedCall = { resolve, reject };

      // Optional queue timeout
      if (this.queueTimeout > 0) {
        queuedCall.timeoutId = setTimeout(() => {
          const idx = this.queue.indexOf(queuedCall);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            this.rejectedCount++;
            reject(
              new BulkheadError(
                `Bulkhead queue timeout after ${this.queueTimeout}ms`
              )
            );
          }
        }, this.queueTimeout);
      }

      this.queue.push(queuedCall);
    });
  }

  private releasePermit(): void {
    this.activeCalls--;

    // If there are queued calls, dequeue one
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }
      this.activeCalls++;
      next.resolve();
    }
  }
}
