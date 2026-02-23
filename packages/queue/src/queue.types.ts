/**
 * Queue module types
 */

import type { JobsOptions } from 'bullmq';

/**
 * Redis connection options for BullMQ
 * Passed to ioredis constructor
 */
export interface RedisConnectionOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  retryStrategy?: (times: number) => number | null;
  [key: string]: unknown;
}

/**
 * Options for adding a job to the queue
 */
export interface QueueJobOptions extends Omit<JobsOptions, 'repeat'> {
  /** Delay before job is processed (ms) */
  delay?: number;
  /** Job priority (higher = processed first) */
  priority?: number;
  /** Number of attempts before failing */
  attempts?: number;
  /** Backoff strategy: 'fixed' | 'exponential' */
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  /** Job timeout (ms) */
  timeout?: number;
}

/**
 * Queue processor metadata
 */
export interface QueueProcessorMetadata {
  queueName: string;
  methodName: string;
  target: object;
}
