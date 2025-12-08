/**
 * Cron job types and interfaces
 */

/**
 * Cron expression type
 * Format: second minute hour day-of-month month day-of-week
 * Examples:
 * - '* * * * * *' - Every second
 * - '0 * * * * *' - Every minute
 * - '0 0 * * * *' - Every hour
 * - '0 0 0 * * *' - Every day at midnight
 * - '0 0 9 * * 1-5' - Every weekday at 9 AM
 */
export type CronExpression = string;

/**
 * Cron job options
 */
export interface CronOptions {
  /**
   * Name of the cron job (for logging and management)
   */
  name?: string;

  /**
   * Cron expression defining when the job should run
   */
  cronTime: CronExpression;

  /**
   * Timezone for the cron job
   * @default 'UTC'
   */
  timeZone?: string;

  /**
   * Whether to start the job immediately
   * @default true
   */
  runOnInit?: boolean;

  /**
   * Whether the job is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of times the job can run
   */
  maxRuns?: number;

  /**
   * Error handler for the job
   */
  onError?: (error: Error) => void;

  /**
   * Callback when job completes
   */
  onComplete?: () => void;
}

/**
 * Cron job metadata
 */
export interface CronJobMetadata {
  /**
   * Target class
   */
  target: object;

  /**
   * Method name
   */
  methodName: string;

  /**
   * Cron options
   */
  options: CronOptions;
}

/**
 * Cron job status
 */
export interface CronJobStatus {
  /**
   * Job name
   */
  name: string;

  /**
   * Whether the job is running
   */
  isRunning: boolean;

  /**
   * Last execution time
   */
  lastExecution?: Date;

  /**
   * Next execution time
   */
  nextExecution?: Date;

  /**
   * Number of times the job has run
   */
  runCount: number;

  /**
   * Whether the job is enabled
   */
  enabled: boolean;
}

/**
 * Predefined cron expressions
 */
export const CronExpression = {
  /**
   * Every second
   */
  EVERY_SECOND: '* * * * * *',

  /**
   * Every 5 seconds
   */
  EVERY_5_SECONDS: '*/5 * * * * *',

  /**
   * Every 10 seconds
   */
  EVERY_10_SECONDS: '*/10 * * * * *',

  /**
   * Every 30 seconds
   */
  EVERY_30_SECONDS: '*/30 * * * * *',

  /**
   * Every minute
   */
  EVERY_MINUTE: '0 * * * * *',

  /**
   * Every 5 minutes
   */
  EVERY_5_MINUTES: '0 */5 * * * *',

  /**
   * Every 10 minutes
   */
  EVERY_10_MINUTES: '0 */10 * * * *',

  /**
   * Every 30 minutes
   */
  EVERY_30_MINUTES: '0 */30 * * * *',

  /**
   * Every hour
   */
  EVERY_HOUR: '0 0 * * * *',

  /**
   * Every day at midnight
   */
  EVERY_DAY_AT_MIDNIGHT: '0 0 0 * * *',

  /**
   * Every day at noon
   */
  EVERY_DAY_AT_NOON: '0 0 12 * * *',

  /**
   * Every week (Sunday at midnight)
   */
  EVERY_WEEK: '0 0 0 * * 0',

  /**
   * Every weekday (Monday-Friday at midnight)
   */
  EVERY_WEEKDAY: '0 0 0 * * 1-5',

  /**
   * Every weekend (Saturday and Sunday at midnight)
   */
  EVERY_WEEKEND: '0 0 0 * * 0,6',

  /**
   * Every month (1st day at midnight)
   */
  EVERY_MONTH: '0 0 0 1 * *',

  /**
   * Every quarter (1st day of Jan, Apr, Jul, Oct at midnight)
   */
  EVERY_QUARTER: '0 0 0 1 */3 *',

  /**
   * Every year (Jan 1st at midnight)
   */
  EVERY_YEAR: '0 0 0 1 1 *',
} as const;
