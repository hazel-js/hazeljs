import { Injectable } from '@hazeljs/core';
import { CronOptions, CronJobStatus } from './cron.types';
import logger from '@hazeljs/core';

/**
 * Represents a scheduled cron job
 */
class CronJob {
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _lastExecution?: Date;
  private _nextExecution?: Date;
  private _runCount = 0;
  private _enabled = true;

  constructor(
    public readonly name: string,
    private readonly cronExpression: string,
    private readonly callback: () => void | Promise<void>,
    private readonly options: CronOptions
  ) {
    this._enabled = options.enabled !== false;
  }

  /**
   * Start the cron job
   */
  start(): void {
    if (this.timer) {
      logger.warn(`Cron job "${this.name}" is already running`);
      return;
    }

    if (!this._enabled) {
      logger.warn(`Cron job "${this.name}" is disabled`);
      return;
    }

    const interval = this.parseExpression(this.cronExpression);
    this._nextExecution = new Date(Date.now() + interval);

    this.timer = setInterval(async () => {
      await this.execute();
    }, interval);

    // Run on init if specified
    if (this.options.runOnInit) {
      this.execute();
    }

    logger.info(`Cron job "${this.name}" started with expression: ${this.cronExpression}`);
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this._nextExecution = undefined;
      logger.info(`Cron job "${this.name}" stopped`);
    }
  }

  /**
   * Execute the job
   */
  private async execute(): Promise<void> {
    if (this._isRunning) {
      logger.warn(`Cron job "${this.name}" is already executing, skipping this run`);
      return;
    }

    // Check max runs
    if (this.options.maxRuns && this._runCount >= this.options.maxRuns) {
      logger.info(`Cron job "${this.name}" reached max runs (${this.options.maxRuns}), stopping`);
      this.stop();
      return;
    }

    this._isRunning = true;
    this._lastExecution = new Date();
    this._runCount++;

    try {
      logger.debug(`Executing cron job "${this.name}" (run #${this._runCount})`);
      await this.callback();

      if (this.options.onComplete) {
        this.options.onComplete();
      }
    } catch (error) {
      logger.error(`Error executing cron job "${this.name}":`, error);

      if (this.options.onError) {
        this.options.onError(error as Error);
      }
    } finally {
      this._isRunning = false;

      // Calculate next execution
      const interval = this.parseExpression(this.cronExpression);
      this._nextExecution = new Date(Date.now() + interval);
    }
  }

  /**
   * Parse cron expression to milliseconds
   * Format: second minute hour day-of-month month day-of-week
   */
  private parseExpression(expression: string): number {
    const parts = expression.split(' ');

    if (parts.length !== 6) {
      throw new Error(
        `Invalid cron expression: ${expression}. Expected 6 parts (second minute hour day month weekday)`
      );
    }

    const [second, minute, hour, , ,] = parts;

    // Simple parser for common patterns
    // For production, consider using a library like 'cron-parser'

    // Every second
    if (expression === '* * * * * *') {
      return 1000;
    }

    // Every N seconds
    const secondMatch = second.match(/^\*\/(\d+)$/);
    if (secondMatch && minute === '*' && hour === '*') {
      return parseInt(secondMatch[1]) * 1000;
    }

    // Every minute
    if (second === '0' && minute === '*' && hour === '*') {
      return 60 * 1000;
    }

    // Every N minutes
    const minuteMatch = minute.match(/^\*\/(\d+)$/);
    if (second === '0' && minuteMatch && hour === '*') {
      return parseInt(minuteMatch[1]) * 60 * 1000;
    }

    // Every hour
    if (second === '0' && minute === '0' && hour === '*') {
      return 60 * 60 * 1000;
    }

    // Every N hours
    const hourMatch = hour.match(/^\*\/(\d+)$/);
    if (second === '0' && minute === '0' && hourMatch) {
      return parseInt(hourMatch[1]) * 60 * 60 * 1000;
    }

    // Every day (24 hours)
    if (second === '0' && minute === '0' && hour === '0') {
      return 24 * 60 * 60 * 1000;
    }

    // Default to 1 minute for unsupported patterns
    logger.warn(
      `Cron expression "${expression}" uses advanced features. Defaulting to 1 minute interval. Consider using a cron parser library for complex expressions.`
    );
    return 60 * 1000;
  }

  /**
   * Enable the job
   */
  enable(): void {
    this._enabled = true;
    logger.info(`Cron job "${this.name}" enabled`);
  }

  /**
   * Disable the job
   */
  disable(): void {
    this._enabled = false;
    this.stop();
    logger.info(`Cron job "${this.name}" disabled`);
  }

  /**
   * Get job status
   */
  getStatus(): CronJobStatus {
    return {
      name: this.name,
      isRunning: this._isRunning,
      lastExecution: this._lastExecution,
      nextExecution: this._nextExecution,
      runCount: this._runCount,
      enabled: this._enabled,
    };
  }
}

/**
 * Cron service for managing scheduled jobs
 */
@Injectable()
export class CronService {
  private jobs = new Map<string, CronJob>();

  /**
   * Register a new cron job
   */
  registerJob(
    name: string,
    cronExpression: string,
    callback: () => void | Promise<void>,
    options: CronOptions = { cronTime: cronExpression }
  ): void {
    if (this.jobs.has(name)) {
      logger.warn(`Cron job "${name}" already exists, replacing it`);
      this.deleteJob(name);
    }

    const job = new CronJob(name, cronExpression, callback, options);
    this.jobs.set(name, job);

    // Auto-start if not explicitly disabled
    if (options.enabled !== false) {
      job.start();
    }
  }

  /**
   * Delete a cron job
   */
  deleteJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Cron job "${name}" deleted`);
      return true;
    }
    return false;
  }

  /**
   * Start a specific job
   */
  startJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      return true;
    }
    logger.warn(`Cron job "${name}" not found`);
    return false;
  }

  /**
   * Stop a specific job
   */
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      return true;
    }
    logger.warn(`Cron job "${name}" not found`);
    return false;
  }

  /**
   * Enable a job
   */
  enableJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.enable();
      return true;
    }
    logger.warn(`Cron job "${name}" not found`);
    return false;
  }

  /**
   * Disable a job
   */
  disableJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.disable();
      return true;
    }
    logger.warn(`Cron job "${name}" not found`);
    return false;
  }

  /**
   * Get status of a specific job
   */
  getJobStatus(name: string): CronJobStatus | undefined {
    const job = this.jobs.get(name);
    return job?.getStatus();
  }

  /**
   * Get status of all jobs
   */
  getAllJobStatuses(): CronJobStatus[] {
    return Array.from(this.jobs.values()).map((job) => job.getStatus());
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    this.jobs.forEach((job) => job.stop());
    logger.info('All cron jobs stopped');
  }

  /**
   * Start all jobs
   */
  startAll(): void {
    this.jobs.forEach((job) => job.start());
    logger.info('All cron jobs started');
  }

  /**
   * Clear all jobs
   */
  clearAll(): void {
    this.stopAll();
    this.jobs.clear();
    logger.info('All cron jobs cleared');
  }

  /**
   * Get number of registered jobs
   */
  getJobCount(): number {
    return this.jobs.size;
  }
}
