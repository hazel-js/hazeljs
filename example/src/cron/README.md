# Cron Jobs Example

This example demonstrates how to use the cron module in HazelJS to schedule and manage recurring tasks.

## Features

- ✅ Decorator-based cron job definition
- ✅ Multiple scheduling patterns
- ✅ Job lifecycle management (start, stop, enable, disable)
- ✅ Error handling and completion callbacks
- ✅ Job statistics and monitoring
- ✅ REST API for job management

## Running the Example

```bash
# From the hazeljs root directory
npm run build

# Run the cron example
ts-node example/src/cron/index.ts
```

## Example Jobs

### 1. Daily Cleanup
Runs every day at midnight in production (every 3 minutes for demo).

```typescript
@Cron({
  name: 'daily-cleanup',
  cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT, // Use '0 */3 * * * *' for demo
  runOnInit: false,
})
async handleDailyCleanup(): Promise<void> {
  logger.info('Running daily cleanup...');
  // Your cleanup logic here
}
```

### 2. Simple Task
Runs every 10 seconds to demonstrate basic scheduling.

```typescript
@Cron({
  name: 'simple-task',
  cronTime: CronExpression.EVERY_10_SECONDS,
  runOnInit: false,
})
async handleSimpleTask(): Promise<void> {
  logger.info('Simple task executed');
}
```

### 3. Email Notifications
Runs every 30 seconds with error handling and completion callbacks.

```typescript
@Cron({
  name: 'email-notifications',
  cronTime: CronExpression.EVERY_30_SECONDS,
  runOnInit: false,
  onComplete: () => {
    logger.debug('Email notification task completed');
  },
  onError: (error: Error) => {
    logger.error('Email notification task failed:', error);
  },
})
async sendEmailNotifications(): Promise<void> {
  // Send emails
}
```

### 4. Daily Report
Runs every 2 minutes with a maximum of 5 executions.

```typescript
@Cron({
  name: 'daily-report',
  cronTime: '0 */2 * * * *',
  runOnInit: true,
  maxRuns: 5,
})
async generateDailyReport(): Promise<void> {
  // Generate report
}
```

### 5. Database Cleanup
Runs every 5 minutes but is disabled by default.

```typescript
@Cron({
  name: 'database-cleanup',
  cronTime: CronExpression.EVERY_5_MINUTES,
  runOnInit: false,
  enabled: false,
})
async cleanupDatabase(): Promise<void> {
  // Cleanup database
}
```

## API Endpoints

### List All Jobs
```bash
curl http://localhost:3000/cron/jobs
```

Response:
```json
{
  "jobs": [
    {
      "name": "simple-task",
      "isRunning": false,
      "lastExecution": "2024-01-01T12:00:00.000Z",
      "nextExecution": "2024-01-01T12:00:10.000Z",
      "runCount": 5,
      "enabled": true
    }
  ],
  "totalJobs": 4
}
```

### Get Specific Job Status
```bash
curl http://localhost:3000/cron/jobs/simple-task
```

### Start a Job
```bash
curl -X POST http://localhost:3000/cron/jobs/simple-task/start
```

### Stop a Job
```bash
curl -X POST http://localhost:3000/cron/jobs/simple-task/stop
```

### Enable a Job
```bash
curl -X POST http://localhost:3000/cron/jobs/database-cleanup/enable
```

### Disable a Job
```bash
curl -X POST http://localhost:3000/cron/jobs/simple-task/disable
```

### Get Task Statistics
```bash
curl http://localhost:3000/cron/stats
```

Response:
```json
{
  "taskCount": 10,
  "emailCount": 5,
  "reportCount": 3
}
```

### Start All Jobs
```bash
curl -X POST http://localhost:3000/cron/start-all
```

### Stop All Jobs
```bash
curl -X POST http://localhost:3000/cron/stop-all
```

## Cron Expression Format

Cron expressions use 6 fields:
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

## Predefined Expressions

The `CronExpression` object provides common patterns:

- `EVERY_SECOND` - `* * * * * *`
- `EVERY_5_SECONDS` - `*/5 * * * * *`
- `EVERY_10_SECONDS` - `*/10 * * * * *`
- `EVERY_30_SECONDS` - `*/30 * * * * *`
- `EVERY_MINUTE` - `0 * * * * *`
- `EVERY_5_MINUTES` - `0 */5 * * * *`
- `EVERY_10_MINUTES` - `0 */10 * * * *`
- `EVERY_30_MINUTES` - `0 */30 * * * *`
- `EVERY_HOUR` - `0 0 * * * *`
- `EVERY_DAY_AT_MIDNIGHT` - `0 0 0 * * *`
- `EVERY_DAY_AT_NOON` - `0 0 12 * * *`
- `EVERY_WEEK` - `0 0 0 * * 0`
- `EVERY_WEEKDAY` - `0 0 0 * * 1-5`
- `EVERY_WEEKEND` - `0 0 0 * * 0,6`
- `EVERY_MONTH` - `0 0 0 1 * *`
- `EVERY_QUARTER` - `0 0 0 1 */3 *`
- `EVERY_YEAR` - `0 0 0 1 1 *`

## Cron Options

```typescript
interface CronOptions {
  name?: string;           // Job name for identification
  cronTime: string;        // Cron expression
  timeZone?: string;       // Timezone (default: UTC)
  runOnInit?: boolean;     // Run immediately on start (default: true)
  enabled?: boolean;       // Whether job is enabled (default: true)
  maxRuns?: number;        // Maximum number of executions
  onError?: (error: Error) => void;     // Error handler
  onComplete?: () => void;              // Completion callback
}
```

## Programmatic Usage

You can also use the `CronService` directly without decorators:

```typescript
import { CronService } from '@hazeljs/cron';

// Inject CronService
constructor(private cronService: CronService) {}

// Register a job
this.cronService.registerJob(
  'my-job',
  '0 * * * * *', // Every minute
  async () => {
    console.log('Job executed');
  },
  {
    enabled: true,
    runOnInit: false,
  }
);

// Manage jobs
this.cronService.startJob('my-job');
this.cronService.stopJob('my-job');
this.cronService.deleteJob('my-job');

// Get status
const status = this.cronService.getJobStatus('my-job');
const allStatuses = this.cronService.getAllJobStatuses();
```

## Notes

- The current implementation uses a simple interval-based scheduler
- For production use with complex cron expressions, consider integrating a library like `cron-parser` or `node-cron`
- Jobs run in the same process as your application
- For distributed systems, consider using a dedicated job queue like Bull or BullMQ
