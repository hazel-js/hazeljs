import { Injectable } from '@hazeljs/core';
import { Cron } from '@hazeljs/cron';
import { CronExpression } from '@hazeljs/cron';
import logger from '@hazeljs/core';

/**
 * Example service demonstrating cron job usage
 */
@Injectable()
export class TaskService {
  private taskCount = 0;
  private emailCount = 0;
  private reportCount = 0;
  private cleanupCount = 0;

  /**
   * Daily cleanup task
   * Runs every day at midnight in production
   * For demo purposes, runs every 3 minutes
   */
  @Cron({
    name: 'daily-cleanup',
    cronTime: '0 */3 * * * *', // Every 3 minutes for demo (use CronExpression.EVERY_DAY_AT_MIDNIGHT in production)
    runOnInit: false,
  })
  async handleDailyCleanup(): Promise<void> {
    this.cleanupCount++;
    logger.info(`[CRON] Running daily cleanup... (count: ${this.cleanupCount})`);

    // Simulate cleanup operations
    await new Promise((resolve) => setTimeout(resolve, 1500));

    logger.info('[CRON] Daily cleanup completed successfully');
  }

  /**
   * Simple task that runs every 10 seconds
   */
  @Cron({
    name: 'simple-task',
    cronTime: CronExpression.EVERY_10_SECONDS,
    runOnInit: false,
  })
  async handleSimpleTask(): Promise<void> {
    this.taskCount++;
    logger.info(`[CRON] Simple task executed (count: ${this.taskCount})`);
  }

  /**
   * Email notification task that runs every 30 seconds
   */
  @Cron({
    name: 'email-notifications',
    cronTime: CronExpression.EVERY_30_SECONDS,
    runOnInit: false,
    onComplete: () => {
      logger.debug('[CRON] Email notification task completed');
    },
    onError: (error: Error) => {
      logger.error('[CRON] Email notification task failed:', error);
    },
  })
  async sendEmailNotifications(): Promise<void> {
    this.emailCount++;
    logger.info(`[CRON] Sending email notifications (count: ${this.emailCount})`);

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info('[CRON] Email notifications sent successfully');
  }

  /**
   * Daily report generation task
   * This would run every day at midnight in production
   * For demo purposes, we'll use a shorter interval
   */
  @Cron({
    name: 'daily-report',
    cronTime: '0 */2 * * * *', // Every 2 minutes for demo
    runOnInit: true,
    maxRuns: 5, // Stop after 5 runs for demo
  })
  async generateDailyReport(): Promise<void> {
    this.reportCount++;
    logger.info(`[CRON] Generating daily report (count: ${this.reportCount})`);

    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info('[CRON] Daily report generated successfully');
  }

  /**
   * Database cleanup task
   * Runs every 5 minutes
   */
  @Cron({
    name: 'database-cleanup',
    cronTime: CronExpression.EVERY_5_MINUTES,
    runOnInit: false,
    enabled: false, // Disabled by default, can be enabled programmatically
  })
  async cleanupDatabase(): Promise<void> {
    logger.info('[CRON] Running database cleanup...');

    // Simulate cleanup
    await new Promise((resolve) => setTimeout(resolve, 1500));

    logger.info('[CRON] Database cleanup completed');
  }

  /**
   * Get task statistics
   */
  getStats() {
    return {
      taskCount: this.taskCount,
      emailCount: this.emailCount,
      reportCount: this.reportCount,
      cleanupCount: this.cleanupCount,
    };
  }
}
