import { Injectable } from '@hazeljs/core';
import { Queue as BullQueue, JobsOptions } from 'bullmq';
import type { RedisConnectionOptions } from './queue.types';
import logger from '@hazeljs/core';

/**
 * Queue service for adding and managing jobs
 * Uses BullMQ for Redis-backed job queues
 */
@Injectable()
export class QueueService {
  private queues = new Map<string, BullQueue>();
  private connection: RedisConnectionOptions | null = null;

  /**
   * Initialize the queue service with Redis connection options
   * Must be called before using add() or getQueue()
   */
  setConnection(connection: RedisConnectionOptions): void {
    this.connection = connection;
    logger.info('QueueService connection configured');
  }

  /**
   * Get or create a BullMQ Queue instance for the given name
   */
  getQueue<T = unknown>(name: string): BullQueue<T> {
    if (!this.connection) {
      throw new Error(
        'QueueService not configured. Call setConnection() or use QueueModule.forRoot() with connection options.'
      );
    }

    let queue = this.queues.get(name) as BullQueue<T> | undefined;
    if (!queue) {
      queue = new BullQueue<T>(name, {
        connection: this.connection as Record<string, unknown>,
      });
      this.queues.set(name, queue);
      logger.debug(`Queue "${name}" created`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   *
   * @param queueName - Name of the queue
   * @param jobName - Job name/type
   * @param data - Job payload
   * @param options - Job options (delay, priority, attempts, backoff, etc.)
   */
  async add<T = unknown>(
    queueName: string,
    jobName: string,
    data?: T,
    options?: JobsOptions
  ): Promise<{ id: string | undefined }> {
    const queue = this.getQueue<T>(queueName);
    // BullMQ has strict generics for job names; cast for dynamic queue/job names
    const job = await (queue as BullQueue<unknown, unknown, string>).add(
      jobName,
      data ?? {},
      options
    );
    logger.debug(`Job added to queue "${queueName}": ${jobName} (id: ${job.id})`);
    return { id: job.id };
  }

  /**
   * Add a job with a delay
   */
  async addDelayed<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number
  ): Promise<{ id: string | undefined }> {
    return this.add(queueName, jobName, data, { delay: delayMs });
  }

  /**
   * Add a job with retry configuration
   */
  async addWithRetry<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options: { attempts?: number; backoff?: { type: 'fixed' | 'exponential'; delay: number } }
  ): Promise<{ id: string | undefined }> {
    return this.add(queueName, jobName, data, options);
  }

  /**
   * Close all queue connections
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((q) => q.close());
    await Promise.all(closePromises);
    this.queues.clear();
    logger.info('QueueService: all queues closed');
  }
}
