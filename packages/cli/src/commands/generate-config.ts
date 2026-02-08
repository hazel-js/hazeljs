import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

const CONFIG_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
import { ConfigModule, ConfigService } from '@hazeljs/config';

// Import ConfigModule.forRoot() in your app module:
//
// @HazelModule({
//   imports: [
//     ConfigModule.forRoot({
//       envFilePath: '.env',
//     }),
//   ],
// })
//
// Then inject ConfigService wherever you need it:
//
// constructor(private readonly config: ConfigService) {}
//
// Usage:
//   this.config.get('DATABASE_URL');
//   this.config.get('PORT', '3000');  // with default value

export { ConfigModule, ConfigService };
`;

class ConfigGenerator extends Generator {
  protected suffix = 'config';

  protected getDefaultTemplate(): string {
    return CONFIG_TEMPLATE;
  }
}

export function generateConfig(command: Command) {
  command
    .command('config')
    .description('Generate a config module setup')
    .option('-p, --path <path>', 'Specify the path', 'src')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (options: { path?: string; dryRun?: boolean }) => {
      const generator = new ConfigGenerator();
      await generator.generate({ name: 'app', path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  1. npm install @hazeljs/config'));
        console.log(chalk.gray('  2. Add ConfigModule.forRoot({ envFilePath: ".env" }) to your app module imports'));
        console.log(chalk.gray('  3. Create a .env file in your project root'));
      }
    });
}
