import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

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

export async function runConfig(_name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new ConfigGenerator();
  const result = await generator.generate({ name: 'app', path: options.path, dryRun: options.dryRun });
  result.nextSteps = [
    'npm install @hazeljs/config',
    'Add ConfigModule.forRoot({ envFilePath: ".env" }) to your app module imports',
    'Create a .env file in your project root',
  ];
  return result;
}

export function generateConfig(command: Command) {
  command
    .command('config')
    .description('Generate a config module setup')
    .option('-p, --path <path>', 'Specify the path', 'src')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (options: GenerateCLIOptions) => {
      const result = await runConfig('app', options);
      printGenerateResult(result, { json: options.json });
    });
}
