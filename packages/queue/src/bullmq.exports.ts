/**
 * Re-export BullMQ primitives so apps depend only on @hazeljs/queue and stay on this package's BullMQ range.
 *
 * BullMQ's Queue class is exported as BullMQQueue — this package already exports a @Queue decorator named Queue.
 */

export { Worker, Queue as BullMQQueue } from 'bullmq';
export type { Job, JobsOptions, WorkerOptions } from 'bullmq';
