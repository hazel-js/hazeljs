/**
 * Cron Jobs Example
 *
 * This example demonstrates how to use the cron module in HazelJS.
 * It shows:
 * - Creating scheduled tasks with decorators
 * - Managing cron jobs via REST API
 * - Different cron expressions and options
 */

import { HazelApp } from '@hazeljs/core';
import { CronExampleModule } from './cron.module';
import { CronModule } from '@hazeljs/cron';
import { TaskService } from './task.service';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';

async function bootstrap() {
  // Create the application
  const app = new HazelApp(CronExampleModule);

  // Register cron jobs from TaskService
  // This is necessary because the framework doesn't auto-discover decorated methods yet
  const container = Container.getInstance();
  const taskService = container.resolve(TaskService);

  if (taskService) {
    CronModule.registerJobsFromProvider(taskService);
    logger.info('Cron jobs registered successfully');
  } else {
    logger.error('TaskService not found in container');
  }

  // Start the server
  const port = 3000;
  await app.listen(port);

  logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                   CRON JOBS EXAMPLE RUNNING                   ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Server is running on http://localhost:${port}                   ║
║                                                               ║
║  Available Endpoints:                                         ║
║  • GET  /cron/jobs          - List all cron jobs             ║
║  • GET  /cron/jobs/:name    - Get specific job status        ║
║  • POST /cron/jobs/:name/start   - Start a job              ║
║  • POST /cron/jobs/:name/stop    - Stop a job               ║
║  • POST /cron/jobs/:name/enable  - Enable a job             ║
║  • POST /cron/jobs/:name/disable - Disable a job            ║
║  • GET  /cron/stats         - Get task statistics            ║
║  • POST /cron/start-all     - Start all jobs                 ║
║  • POST /cron/stop-all      - Stop all jobs                  ║
║                                                               ║
║  Scheduled Jobs:                                              ║
║  • daily-cleanup        - Every 3 minutes (demo)             ║
║  • simple-task          - Every 10 seconds                   ║
║  • email-notifications  - Every 30 seconds                   ║
║  • daily-report         - Every 2 minutes (max 5 runs)       ║
║  • database-cleanup     - Every 5 minutes (disabled)         ║
║                                                               ║
║  Watch the console for cron job execution logs!              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
