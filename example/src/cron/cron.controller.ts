import { Controller, Get, Post, Param } from '@hazeljs/core';
import { CronService } from '@hazeljs/cron';
import { TaskService } from './task.service';

/**
 * Controller for managing cron jobs
 */
@Controller('/cron')
export class CronController {
  constructor(
    private cronService: CronService,
    private taskService: TaskService
  ) {}

  /**
   * Get all cron job statuses
   */
  @Get('/jobs')
  getAllJobs() {
    return {
      jobs: this.cronService.getAllJobStatuses(),
      totalJobs: this.cronService.getJobCount(),
    };
  }

  /**
   * Get specific job status
   */
  @Get('/jobs/:name')
  getJob(@Param('name') name: string) {
    const status = this.cronService.getJobStatus(name);
    if (!status) {
      return { error: 'Job not found' };
    }
    return status;
  }

  /**
   * Start a specific job
   */
  @Post('/jobs/:name/start')
  startJob(@Param('name') name: string) {
    const success = this.cronService.startJob(name);
    return {
      success,
      message: success ? `Job "${name}" started` : `Job "${name}" not found`,
    };
  }

  /**
   * Stop a specific job
   */
  @Post('/jobs/:name/stop')
  stopJob(@Param('name') name: string) {
    const success = this.cronService.stopJob(name);
    return {
      success,
      message: success ? `Job "${name}" stopped` : `Job "${name}" not found`,
    };
  }

  /**
   * Enable a specific job
   */
  @Post('/jobs/:name/enable')
  enableJob(@Param('name') name: string) {
    const success = this.cronService.enableJob(name);
    return {
      success,
      message: success ? `Job "${name}" enabled` : `Job "${name}" not found`,
    };
  }

  /**
   * Disable a specific job
   */
  @Post('/jobs/:name/disable')
  disableJob(@Param('name') name: string) {
    const success = this.cronService.disableJob(name);
    return {
      success,
      message: success ? `Job "${name}" disabled` : `Job "${name}" not found`,
    };
  }

  /**
   * Get task statistics
   */
  @Get('/stats')
  getStats() {
    return this.taskService.getStats();
  }

  /**
   * Start all jobs
   */
  @Post('/start-all')
  startAll() {
    this.cronService.startAll();
    return { message: 'All jobs started' };
  }

  /**
   * Stop all jobs
   */
  @Post('/stop-all')
  stopAll() {
    this.cronService.stopAll();
    return { message: 'All jobs stopped' };
  }
}
