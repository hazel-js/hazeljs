import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const CRON_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';

@Service()
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

export async function runCron(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new CronServiceGenerator();
  const result = await generator.generate({ name, path: options.path, dryRun: options.dryRun });
  result.nextSteps = [
    'npm install @hazeljs/cron',
    'Add CronModule to your module imports',
    'Register this service as a provider',
  ];
  return result;
}

export function generateCron(command: Command) {
  command
    .command('cron <name>')
    .description('Generate a cron/scheduled job service')
    .alias('job')
    .option('-p, --path <path>', 'Specify the path')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runCron(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
