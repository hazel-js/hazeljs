import { Injectable } from '@hazeljs/core';
import { CronOptions, CronJobStatus } from './cron.types';
import logger from '@hazeljs/core';
import cron from 'node-cron';

/**
 * Represents a scheduled cron job
 * Uses node-cron for proper cron expression parsing and scheduling
 */
class CronJob {
  private task: cron.ScheduledTask | null = null;
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

    // node-cron uses 5-field (minute-level) or 6-field (second-level) expressions
    // Validate the expression upfront
    const expr = this.normalizeExpression(this.cronExpression);
    if (!cron.validate(expr)) {
      throw new Error(
        `Invalid cron expression: ${this.cronExpression}. ` +
        `Format: second minute hour day-of-month month day-of-week`
      );
    }
  }

  /**
   * Normalize expression for node-cron compatibility
   * node-cron supports both 5-field (no seconds) and 6-field (with seconds)
   */
  private normalizeExpression(expression: string): string {
    return expression;
  }

  /**
   * Start the cron job
   */
  start(): void {
    if (this.task) {
      logger.warn(`Cron job "${this.name}" is already running`);
      return;
    }

    if (!this._enabled) {
      logger.warn(`Cron job "${this.name}" is disabled`);
      return;
    }

    const expr = this.normalizeExpression(this.cronExpression);

    this.task = cron.schedule(expr, async () => {
      await this.execute();
    }, {
      scheduled: true,
      timezone: this.options.timeZone,
    });

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
    if (this.task) {
      this.task.stop();
      this.task = null;
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
    }
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
