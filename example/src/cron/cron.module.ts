import { HazelModule } from '@hazeljs/core';
import { CronModule } from '@hazeljs/cron';
import { CronController } from './cron.controller';
import { TaskService } from './task.service';

/**
 * Example module demonstrating cron job usage
 */
@HazelModule({
  imports: [CronModule],
  controllers: [CronController],
  providers: [TaskService],
})
export class CronExampleModule {}
