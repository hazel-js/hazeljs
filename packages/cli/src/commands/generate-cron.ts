import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

const CRON_SERVICE_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';

@Injectable()
export class {{className}}CronService {
  @Cron(CronExpression.EVERY_MINUTE)
  handleEveryMinute() {
    console.log('[{{className}}Cron] Running every minute...');
    // Add your cron job logic here
  }

  @Cron('0 0 * * *')  // Every day at midnight
  handleDaily() {
    console.log('[{{className}}Cron] Running daily task...');
    // Add your daily task logic here
  }

  @Cron(CronExpression.EVERY_HOUR)
  handleHourly() {
    console.log('[{{className}}Cron] Running hourly cleanup...');
    // Add your hourly task logic here
  }
}
`;

class CronServiceGenerator extends Generator {
  protected suffix = 'cron';

  protected getDefaultTemplate(): string {
    return CRON_SERVICE_TEMPLATE;
  }
}

export function generateCron(command: Command) {
  command
    .command('cron <name>')
    .description('Generate a cron/scheduled job service')
    .alias('job')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new CronServiceGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. npm install @hazeljs/cron'));
        console.log(chalk.gray('  2. Add CronModule to your module imports'));
        console.log(chalk.gray('  3. Register this service as a provider'));
      }
    });
}
