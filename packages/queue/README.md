# @hazeljs/queue

**Redis-backed Job Queue Module for HazelJS**

Add and process background jobs using BullMQ with Redis. Ideal for distributed systems, cron-triggered workloads, and long-running agent tasks.

[![npm version](https://img.shields.io/npm/v/@hazeljs/queue.svg)](https://www.npmjs.com/package/@hazeljs/queue)
[![License: MIT](https://img.shields.io/npm/l/@hazeljs/queue.svg)](https://opensource.org/licenses/MIT)

## Features

- **Redis-backed** - Uses BullMQ for reliable, distributed job queues
- **QueueService** - Injectable service for adding jobs from controllers and services
- **@Queue decorator** - Mark methods as job processors for Worker setup
- **Job options** - Delay, priority, attempts, backoff, timeout
- **HazelJS integration** - Works with CronModule for distributed cron jobs

## Installation

```bash
npm install @hazeljs/queue ioredis
```

## Quick Start

### 1. Import QueueModule

```typescript
import { HazelModule } from '@hazeljs/core';
import { QueueModule } from '@hazeljs/queue';

@HazelModule({
  imports: [
    QueueModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Add Jobs

```typescript
import { Injectable } from '@hazeljs/core';
import { QueueService } from '@hazeljs/queue';

@Injectable()
export class EmailService {
  constructor(private queue: QueueService) {}

  async sendWelcomeEmail(userId: string, email: string) {
    await this.queue.add('emails', 'welcome', { userId, email });
  }

  async sendDelayedReminder(userId: string, delayMs: number) {
    await this.queue.addDelayed('emails', 'reminder', { userId }, delayMs);
  }

  async processWithRetry(data: { orderId: string }) {
    await this.queue.addWithRetry('orders', 'process', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
```

### 3. Process Jobs with BullMQ Worker

Create a worker process (or run alongside your app) to process jobs:

```typescript
import { Worker } from 'bullmq';

const worker = new Worker(
  'emails',
  async (job) => {
    if (job.name === 'welcome') {
      await sendWelcomeEmail(job.data.userId, job.data.email);
    } else if (job.name === 'reminder') {
      await sendReminder(job.data.userId);
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  }
);

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err));
```

### 4. Using @Queue Decorator for Processor Metadata

The `@Queue` decorator marks methods as job processors. Use `QueueModule.getProcessorMetadata()` to get processor info for Worker setup:

```typescript
import { Injectable } from '@hazeljs/core';
import { Queue } from '@hazeljs/queue';

@Injectable()
export class EmailProcessor {
  @Queue('emails')
  async handleWelcome(job: { data: { userId: string; email: string } }) {
    await this.sendWelcome(job.data.userId, job.data.email);
  }

  @Queue('emails')
  async handleReminder(job: { data: { userId: string } }) {
    await this.sendReminder(job.data.userId);
  }

  private async sendWelcome(userId: string, email: string) {
    // ...
  }
  private async sendReminder(userId: string) {
    // ...
  }
}
```

## Integration with Cron

For distributed cron jobs, enqueue work from cron handlers instead of doing it inline:

```typescript
import { Injectable } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';
import { QueueService } from '@hazeljs/queue';

@Injectable()
export class TaskService {
  constructor(private queue: QueueService) {}

  @Cron({
    name: 'daily-cleanup',
    cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  })
  async triggerCleanup() {
    // Enqueue for distributed processing instead of running inline
    await this.queue.add('maintenance', 'daily-cleanup', {});
  }
}
```

## API Reference

### QueueService

- `add(queueName, jobName, data?, options?)` - Add a job
- `addDelayed(queueName, jobName, data, delayMs)` - Add a delayed job
- `addWithRetry(queueName, jobName, data, options)` - Add with retry config
- `getQueue(name)` - Get BullMQ Queue instance
- `close()` - Close all queue connections

### Job Options (JobsOptions)

- `delay` - Delay before processing (ms)
- `priority` - Higher = processed first
- `attempts` - Retry count
- `backoff` - `{ type: 'fixed' | 'exponential', delay: number }`
- `timeout` - Job timeout (ms)

## See Also

- [Cron Jobs Guide](../../docs/guides/cron-jobs.md) - Schedule jobs that enqueue to Queue
- [BullMQ Documentation](https://docs.bullmq.io/) - Underlying queue library
