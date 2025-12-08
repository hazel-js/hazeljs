# Cron Jobs Guide

HazelJS provides a powerful cron module for scheduling and managing recurring tasks using decorator-based syntax.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Cron Expressions](#cron-expressions)
- [Decorator Options](#decorator-options)
- [Managing Jobs](#managing-jobs)
- [Programmatic Usage](#programmatic-usage)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Installation

The cron module is included in the core HazelJS package:

```bash
npm install @hazeljs/core @hazeljs/cron
```

## Quick Start

### 1. Import the Cron Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { CronModule } from '@hazeljs/cron';

@HazelModule({
  imports: [CronModule],
  // ... other module options
})
export class AppModule {}
```

### 2. Create a Service with Scheduled Tasks

```typescript
import { Injectable } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';

@Injectable()
export class TaskService {
  @Cron({
    name: 'daily-cleanup',
    cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  })
  async handleDailyCleanup(): Promise<void> {
    console.log('Running daily cleanup...');
    // Your cleanup logic here
  }

  @Cron({
    name: 'send-notifications',
    cronTime: CronExpression.EVERY_5_MINUTES,
  })
  async sendNotifications(): Promise<void> {
    console.log('Sending notifications...');
    // Your notification logic here
  }
}
```

### 3. Register the Jobs

After your application starts, register the cron jobs:

```typescript
import { HazelApp } from '@hazeljs/core';
import { CronModule } from '@hazeljs/cron';
import { Container } from '@hazeljs/core';
import { AppModule } from './app.module';
import { TaskService } from './task.service';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  
  // Get the TaskService instance and register its cron jobs
  const container = Container.getInstance();
  const taskService = container.resolve(TaskService);
  CronModule.registerJobsFromProvider(taskService);
  
  await app.listen(3000);
}

bootstrap();
```

## Cron Expressions

Cron expressions define when a job should run. They consist of 6 fields:

```
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ │ └───── Month (1-12)
│ │ │ └─────── Day of month (1-31)
│ │ └───────── Hour (0-23)
│ └─────────── Minute (0-59)
└───────────── Second (0-59)
```

### Predefined Expressions

HazelJS provides predefined expressions for common patterns:

```typescript
import { CronExpression } from '@hazeljs/cron';

// Time-based
CronExpression.EVERY_SECOND        // * * * * * *
CronExpression.EVERY_5_SECONDS     // */5 * * * * *
CronExpression.EVERY_10_SECONDS    // */10 * * * * *
CronExpression.EVERY_30_SECONDS    // */30 * * * * *
CronExpression.EVERY_MINUTE        // 0 * * * * *
CronExpression.EVERY_5_MINUTES     // 0 */5 * * * *
CronExpression.EVERY_10_MINUTES    // 0 */10 * * * *
CronExpression.EVERY_30_MINUTES    // 0 */30 * * * *
CronExpression.EVERY_HOUR          // 0 0 * * * *

// Daily
CronExpression.EVERY_DAY_AT_MIDNIGHT  // 0 0 0 * * *
CronExpression.EVERY_DAY_AT_NOON      // 0 0 12 * * *

// Weekly
CronExpression.EVERY_WEEK          // 0 0 0 * * 0
CronExpression.EVERY_WEEKDAY       // 0 0 0 * * 1-5
CronExpression.EVERY_WEEKEND       // 0 0 0 * * 0,6

// Monthly/Yearly
CronExpression.EVERY_MONTH         // 0 0 0 1 * *
CronExpression.EVERY_QUARTER       // 0 0 0 1 */3 *
CronExpression.EVERY_YEAR          // 0 0 0 1 1 *
```

### Custom Expressions

You can also create custom expressions:

```typescript
@Cron({
  name: 'custom-schedule',
  cronTime: '0 30 9 * * 1-5', // Every weekday at 9:30 AM
})
async customTask(): Promise<void> {
  // Your logic here
}
```

## Decorator Options

The `@Cron` decorator accepts the following options:

```typescript
interface CronOptions {
  // Job name for identification (required)
  name?: string;
  
  // Cron expression (required)
  cronTime: string;
  
  // Timezone for the cron job
  timeZone?: string;
  
  // Run immediately when the job is registered
  runOnInit?: boolean;
  
  // Whether the job is enabled
  enabled?: boolean;
  
  // Maximum number of times the job can run
  maxRuns?: number;
  
  // Error handler
  onError?: (error: Error) => void;
  
  // Completion callback
  onComplete?: () => void;
}
```

### Examples

#### Run on Initialization

```typescript
@Cron({
  name: 'startup-task',
  cronTime: CronExpression.EVERY_HOUR,
  runOnInit: true, // Runs immediately on startup
})
async startupTask(): Promise<void> {
  console.log('Running on startup and every hour');
}
```

#### Limited Runs

```typescript
@Cron({
  name: 'limited-task',
  cronTime: CronExpression.EVERY_MINUTE,
  maxRuns: 10, // Stops after 10 executions
})
async limitedTask(): Promise<void> {
  console.log('This will run only 10 times');
}
```

#### Error Handling

```typescript
@Cron({
  name: 'error-prone-task',
  cronTime: CronExpression.EVERY_5_MINUTES,
  onError: (error) => {
    console.error('Task failed:', error);
    // Send alert, log to monitoring service, etc.
  },
  onComplete: () => {
    console.log('Task completed successfully');
  },
})
async errorProneTask(): Promise<void> {
  // Task logic that might throw errors
}
```

#### Disabled by Default

```typescript
@Cron({
  name: 'manual-task',
  cronTime: CronExpression.EVERY_HOUR,
  enabled: false, // Won't run until manually enabled
})
async manualTask(): Promise<void> {
  console.log('This task is disabled by default');
}
```

## Managing Jobs

You can manage cron jobs programmatically using the `CronService`:

```typescript
import { Injectable } from '@hazeljs/core';
import { CronService } from '@hazeljs/cron';

@Injectable()
export class JobManagerService {
  constructor(private cronService: CronService) {}

  // Start a job
  startJob(name: string): void {
    this.cronService.startJob(name);
  }

  // Stop a job
  stopJob(name: string): void {
    this.cronService.stopJob(name);
  }

  // Enable a job
  enableJob(name: string): void {
    this.cronService.enableJob(name);
  }

  // Disable a job
  disableJob(name: string): void {
    this.cronService.disableJob(name);
  }

  // Delete a job
  deleteJob(name: string): void {
    this.cronService.deleteJob(name);
  }

  // Get job status
  getJobStatus(name: string) {
    return this.cronService.getJobStatus(name);
  }

  // Get all job statuses
  getAllJobs() {
    return this.cronService.getAllJobStatuses();
  }

  // Start all jobs
  startAll(): void {
    this.cronService.startAll();
  }

  // Stop all jobs
  stopAll(): void {
    this.cronService.stopAll();
  }
}
```

### Job Status

The job status includes:

```typescript
interface CronJobStatus {
  name: string;              // Job name
  isRunning: boolean;        // Whether currently executing
  lastExecution?: Date;      // Last execution time
  nextExecution?: Date;      // Next scheduled execution
  runCount: number;          // Number of times executed
  enabled: boolean;          // Whether the job is enabled
}
```

## Programmatic Usage

You can also register jobs programmatically without decorators:

```typescript
import { Injectable } from '@hazeljs/core';
import { CronService, CronExpression } from '@hazeljs/cron';

@Injectable()
export class DynamicJobService {
  constructor(private cronService: CronService) {
    this.registerDynamicJobs();
  }

  private registerDynamicJobs(): void {
    // Register a simple job
    this.cronService.registerJob(
      'dynamic-job',
      CronExpression.EVERY_MINUTE,
      async () => {
        console.log('Dynamic job executed');
      },
      {
        enabled: true,
        runOnInit: false,
      }
    );

    // Register a job with error handling
    this.cronService.registerJob(
      'complex-job',
      '0 */15 * * * *', // Every 15 minutes
      async () => {
        await this.complexTask();
      },
      {
        enabled: true,
        onError: (error) => {
          console.error('Complex job failed:', error);
        },
        onComplete: () => {
          console.log('Complex job completed');
        },
      }
    );
  }

  private async complexTask(): Promise<void> {
    // Complex task logic
  }
}
```

## Best Practices

### 1. Use Meaningful Names

```typescript
// Good
@Cron({
  name: 'user-cleanup-inactive-accounts',
  cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
})

// Bad
@Cron({
  name: 'job1',
  cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
})
```

### 2. Handle Errors Gracefully

```typescript
@Cron({
  name: 'critical-task',
  cronTime: CronExpression.EVERY_HOUR,
  onError: async (error) => {
    // Log to monitoring service
    await logger.error('Critical task failed', { error });
    
    // Send alert
    await alertService.send('Critical task failed');
  },
})
async criticalTask(): Promise<void> {
  try {
    // Task logic
  } catch (error) {
    // Handle specific errors
    throw error; // Re-throw to trigger onError
  }
}
```

### 3. Avoid Long-Running Tasks

```typescript
// Good - Quick task
@Cron({
  name: 'quick-check',
  cronTime: CronExpression.EVERY_MINUTE,
})
async quickCheck(): Promise<void> {
  const needsProcessing = await this.checkStatus();
  if (needsProcessing) {
    // Queue for background processing
    await this.queueService.add('process-task');
  }
}

// Bad - Long-running task
@Cron({
  name: 'slow-task',
  cronTime: CronExpression.EVERY_MINUTE,
})
async slowTask(): Promise<void> {
  // This might take 5 minutes, causing overlapping executions
  await this.processAllRecords();
}
```

### 4. Use Appropriate Intervals

```typescript
// Good - Reasonable interval for the task
@Cron({
  name: 'cache-warmup',
  cronTime: CronExpression.EVERY_5_MINUTES,
})

// Bad - Too frequent for heavy task
@Cron({
  name: 'database-backup',
  cronTime: CronExpression.EVERY_SECOND, // Way too frequent!
})
```

### 5. Test Cron Jobs

```typescript
import { Test } from '@hazeljs/core';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TaskService],
    }).compile();

    service = module.get(TaskService);
  });

  it('should execute daily cleanup', async () => {
    // Test the method directly
    await service.handleDailyCleanup();
    
    // Assert expected behavior
    expect(/* ... */).toBe(/* ... */);
  });
});
```

## Examples

### Email Digest

```typescript
@Cron({
  name: 'send-daily-digest',
  cronTime: '0 0 8 * * *', // Every day at 8 AM
  timeZone: 'America/New_York',
})
async sendDailyDigest(): Promise<void> {
  const users = await this.userService.getActiveUsers();
  
  for (const user of users) {
    const digest = await this.digestService.generate(user);
    await this.emailService.send(user.email, digest);
  }
}
```

### Database Cleanup

```typescript
@Cron({
  name: 'cleanup-old-records',
  cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  onComplete: () => {
    console.log('Cleanup completed');
  },
})
async cleanupOldRecords(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await this.prisma.log.deleteMany({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  });
}
```

### Cache Warming

```typescript
@Cron({
  name: 'warm-cache',
  cronTime: CronExpression.EVERY_HOUR,
  runOnInit: true,
})
async warmCache(): Promise<void> {
  const popularItems = await this.itemService.getPopular();
  
  for (const item of popularItems) {
    await this.cacheService.set(
      `item:${item.id}`,
      item,
      3600 // 1 hour TTL
    );
  }
}
```

### Report Generation

```typescript
@Cron({
  name: 'generate-weekly-report',
  cronTime: '0 0 9 * * 1', // Every Monday at 9 AM
})
async generateWeeklyReport(): Promise<void> {
  const report = await this.reportService.generateWeekly();
  
  await this.storageService.save(
    `reports/weekly-${Date.now()}.pdf`,
    report
  );
  
  await this.notificationService.notify(
    'admins',
    'Weekly report generated'
  );
}
```

## Notes

- The current implementation uses a simple interval-based scheduler
- For production use with complex cron expressions, consider integrating a library like `cron-parser` or `node-cron`
- Jobs run in the same process as your application
- For distributed systems, consider using a dedicated job queue like Bull or BullMQ
- Make sure to handle errors properly to prevent jobs from crashing your application

## See Also

- [Example Application](../../example/src/cron)
- [API Reference](../api/cron.md)
- [Testing Guide](./testing.md)
