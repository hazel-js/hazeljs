# @hazeljs/cron

**Cron Job Scheduling Module for HazelJS**

Schedule and manage recurring tasks with cron expressions and decorator-based API.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cron.svg)](https://www.npmjs.com/package/@hazeljs/cron)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ⏰ **Cron Expressions** - Standard cron syntax support
- 🎨 **Decorator-Based API** - `@Cron`, `@Interval`, `@Timeout`
- 🔄 **Job Management** - Start, stop, and manage scheduled jobs
- 📊 **Job Monitoring** - Track execution history and status
- 🛡️ **Error Handling** - Automatic retry and error recovery
- 🎯 **Timezone Support** - Schedule jobs in specific timezones
- 🔒 **Overlap Prevention** - Prevent concurrent executions
- 📝 **Logging** - Built-in execution logging

## Installation

```bash
npm install @hazeljs/cron
```

## Quick Start

### 1. Import CronModule

```typescript
import { HazelModule } from '@hazeljs/core';
import { CronModule } from '@hazeljs/cron';

@HazelModule({
  imports: [CronModule.forRoot()],
})
export class AppModule {}
```

### 2. Create Scheduled Tasks

```typescript
import { Injectable } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';

@Injectable()
export class TasksService {
  @Cron(CronExpression.EVERY_MINUTE)
  handleEveryMinute() {
    console.log('This runs every minute');
  }

  @Cron('0 0 * * *') // Every day at midnight
  handleMidnight() {
    console.log('This runs at midnight every day');
  }

  @Cron('0 9 * * 1-5') // Weekdays at 9 AM
  handleWeekdayMorning() {
    console.log('This runs Monday-Friday at 9 AM');
  }
}
```

## Cron Expressions

### Predefined Expressions

```typescript
import { CronExpression } from '@hazeljs/cron';

@Cron(CronExpression.EVERY_SECOND)      // Every second
@Cron(CronExpression.EVERY_5_SECONDS)   // Every 5 seconds
@Cron(CronExpression.EVERY_10_SECONDS)  // Every 10 seconds
@Cron(CronExpression.EVERY_30_SECONDS)  // Every 30 seconds
@Cron(CronExpression.EVERY_MINUTE)      // Every minute
@Cron(CronExpression.EVERY_5_MINUTES)   // Every 5 minutes
@Cron(CronExpression.EVERY_10_MINUTES)  // Every 10 minutes
@Cron(CronExpression.EVERY_30_MINUTES)  // Every 30 minutes
@Cron(CronExpression.EVERY_HOUR)        // Every hour
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // Daily at 00:00
@Cron(CronExpression.EVERY_DAY_AT_NOON)     // Daily at 12:00
@Cron(CronExpression.EVERY_WEEK)        // Every Sunday at 00:00
@Cron(CronExpression.EVERY_MONTH)       // First day of month at 00:00
```

### Custom Expressions

```typescript
// Format: second minute hour day month weekday
// * * * * * *

@Cron('0 */15 * * * *')    // Every 15 minutes
@Cron('0 0 12 * * *')      // Every day at noon
@Cron('0 0 0 1 * *')       // First day of every month
@Cron('0 0 9 * * 1-5')     // Weekdays at 9 AM
@Cron('0 30 11 * * 1,3,5') // Mon, Wed, Fri at 11:30 AM
```

## Decorators

### @Cron()

Schedule recurring tasks:

```typescript
@Injectable()
export class TasksService {
  @Cron('0 0 * * *', {
    name: 'daily-cleanup',
    timezone: 'America/New_York',
  })
  async dailyCleanup() {
    console.log('Running daily cleanup');
    await this.cleanupOldData();
  }
}
```

### @Interval()

Run tasks at fixed intervals:

```typescript
@Injectable()
export class MonitoringService {
  @Interval(5000) // Every 5 seconds
  checkHealth() {
    console.log('Health check');
  }

  @Interval(60000, { name: 'metrics-collector' })
  collectMetrics() {
    console.log('Collecting metrics');
  }
}
```

### @Timeout()

Run tasks once after a delay:

```typescript
@Injectable()
export class StartupService {
  @Timeout(5000) // After 5 seconds
  async warmupCache() {
    console.log('Warming up cache');
    await this.cacheService.warmup();
  }
}
```

## Job Management

### Manual Job Control

```typescript
import { Injectable } from '@hazeljs/core';
import { CronService, SchedulerRegistry } from '@hazeljs/cron';

@Injectable()
export class JobManager {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private cronService: CronService
  ) {}

  stopJob(name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.stop();
    console.log(`Job ${name} stopped`);
  }

  startJob(name: string) {
    const job = this.schedulerRegistry.getCronJob(name);
    job.start();
    console.log(`Job ${name} started`);
  }

  deleteJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
    console.log(`Job ${name} deleted`);
  }

  getAllJobs() {
    return this.schedulerRegistry.getCronJobs();
  }
}
```

### Dynamic Job Creation

```typescript
@Injectable()
export class DynamicJobService {
  constructor(private schedulerRegistry: SchedulerRegistry) {}

  addJob(name: string, cronExpression: string, callback: () => void) {
    const job = new CronJob(cronExpression, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }

  removeJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
  }
}
```

## Configuration

### Module Configuration

```typescript
CronModule.forRoot({
  // Enable/disable all cron jobs
  enabled: true,
  
  // Default timezone for all jobs
  timezone: 'UTC',
  
  // Prevent overlapping executions
  preventOverlap: true,
  
  // Retry failed jobs
  retry: {
    attempts: 3,
    delay: 1000,
  },
  
  // Logging
  logging: {
    enabled: true,
    logSuccess: true,
    logErrors: true,
  },
})
```

### Job-Level Configuration

```typescript
@Cron('0 0 * * *', {
  name: 'backup-job',
  timezone: 'America/New_York',
  runOnInit: false,
  preventOverlap: true,
  retryAttempts: 3,
  retryDelay: 5000,
})
async backupDatabase() {
  await this.databaseService.backup();
}
```

## Error Handling

```typescript
@Injectable()
export class TasksService {
  @Cron('0 0 * * *', {
    name: 'risky-job',
    retryAttempts: 3,
    retryDelay: 5000,
  })
  async riskyJob() {
    try {
      await this.performRiskyOperation();
    } catch (error) {
      console.error('Job failed:', error);
      // Error will be retried automatically
      throw error;
    }
  }
}
```

## Use Cases

### Database Cleanup

```typescript
@Injectable()
export class DatabaseCleanupService {
  @Cron('0 2 * * *') // Every day at 2 AM
  async cleanupOldRecords() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await this.db.logs.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    
    console.log('Old records cleaned up');
  }
}
```

### Report Generation

```typescript
@Injectable()
export class ReportService {
  @Cron('0 0 9 * * 1') // Every Monday at 9 AM
  async generateWeeklyReport() {
    const report = await this.analytics.generateWeeklyReport();
    await this.email.send({
      to: 'admin@example.com',
      subject: 'Weekly Report',
      body: report,
    });
  }
}
```

### Cache Warming

```typescript
@Injectable()
export class CacheService {
  @Cron('0 */30 * * * *') // Every 30 minutes
  async warmupCache() {
    const popularProducts = await this.db.products.findMany({
      where: { popular: true },
    });
    
    for (const product of popularProducts) {
      await this.cache.set(`product:${product.id}`, product, 3600);
    }
  }
}
```

### Health Monitoring

```typescript
@Injectable()
export class HealthMonitor {
  @Interval(30000) // Every 30 seconds
  async checkServices() {
    const services = ['database', 'redis', 'api'];
    
    for (const service of services) {
      const isHealthy = await this.checkServiceHealth(service);
      if (!isHealthy) {
        await this.alertService.sendAlert(`${service} is down!`);
      }
    }
  }
}
```

### Data Synchronization

```typescript
@Injectable()
export class SyncService {
  @Cron('0 */5 * * * *') // Every 5 minutes
  async syncData() {
    const localData = await this.getLocalData();
    const remoteData = await this.getRemoteData();
    
    const diff = this.calculateDiff(localData, remoteData);
    await this.applyChanges(diff);
  }
}
```

## Best Practices

1. **Use Named Jobs** - Always provide a name for easier management
2. **Handle Errors** - Implement proper error handling and logging
3. **Prevent Overlaps** - Enable `preventOverlap` for long-running jobs
4. **Set Appropriate Timezones** - Specify timezone for time-sensitive jobs
5. **Monitor Execution** - Track job execution and failures
6. **Test Thoroughly** - Test cron expressions before deploying
7. **Use Intervals for Simple Tasks** - Use `@Interval` for fixed-interval tasks
8. **Cleanup Resources** - Properly cleanup resources in job handlers

## API Reference

### Decorators

```typescript
@Cron(expression: string, options?: CronOptions)
@Interval(milliseconds: number, options?: IntervalOptions)
@Timeout(milliseconds: number, options?: TimeoutOptions)
```

### CronService

```typescript
class CronService {
  addCronJob(name: string, expression: string, callback: () => void): void;
  getCronJob(name: string): CronJob;
  deleteCronJob(name: string): void;
  getCronJobs(): Map<string, CronJob>;
}
```

### SchedulerRegistry

```typescript
class SchedulerRegistry {
  addCronJob(name: string, job: CronJob): void;
  getCronJob(name: string): CronJob;
  deleteCronJob(name: string): void;
  getCronJobs(): Map<string, CronJob>;
  addInterval(name: string, intervalId: NodeJS.Timeout): void;
  deleteInterval(name: string): void;
  addTimeout(name: string, timeoutId: NodeJS.Timeout): void;
  deleteTimeout(name: string): void;
}
```

## Examples

See the [examples](../../example/src/cron) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/cron)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
