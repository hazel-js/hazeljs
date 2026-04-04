/**
 * @hazeljs/queue - Redis-backed job queue module for HazelJS using BullMQ
 */

export { QueueModule, type QueueModuleOptions } from './queue.module';
export { QueueService } from './queue.service';
export { Queue, getQueueProcessorMetadata } from './queue.decorator';
export type { QueueDecoratorOptions } from './queue.decorator';
export type {
  RedisConnectionOptions,
  QueueJobOptions,
  QueueProcessorMetadata,
} from './queue.types';
export { Worker, BullMQQueue } from './bullmq.exports';
export type { Job, JobsOptions, WorkerOptions } from './bullmq.exports';
