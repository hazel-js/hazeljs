import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const SERVERLESS_LAMBDA_TEMPLATE = `import { createLambdaHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createLambdaHandler(AppModule);
`;

const SERVERLESS_CLOUD_FUNCTION_TEMPLATE = `import { createCloudFunctionHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createCloudFunctionHandler(AppModule);
`;

class ServerlessHandlerGenerator extends Generator {
  protected suffix = 'handler';

  protected getDefaultTemplate(): string {
    return SERVERLESS_LAMBDA_TEMPLATE;
  }

  public async generate(options: GeneratorOptions & { platform?: string }): Promise<void> {
    const { platform = 'lambda', ...restOptions } = options;

    const template = platform === 'lambda'
      ? SERVERLESS_LAMBDA_TEMPLATE
      : SERVERLESS_CLOUD_FUNCTION_TEMPLATE;

    await super.generate({
      ...restOptions,
      template,
    });
  }
}

export function generateServerlessHandler(program: Command): void {
  program
    .command('serverless <name>')
    .description('Generate a serverless handler (Lambda or Cloud Function)')
    .alias('sls')
    .option('-p, --path <path>', 'Path where the handler should be generated', 'src')
    .option('--platform <platform>', 'Platform: lambda or cloud-function', 'lambda')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; platform?: string; dryRun?: boolean }) => {
      const generator = new ServerlessHandlerGenerator();
      await generator.generate({ name, path: options.path, platform: options.platform, dryRun: options.dryRun });
    });
}
