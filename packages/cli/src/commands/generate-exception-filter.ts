import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const EXCEPTION_FILTER_TEMPLATE = `import { Catch, type ExceptionFilter, type ArgumentsHost, HttpError, logger } from '@hazeljs/core';

@Catch(HttpError)
export class {{className}}ExceptionFilter implements ExceptionFilter<HttpError> {
  catch(exception: HttpError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.statusCode || 500;
    const message = exception.message || 'Internal server error';

    logger.error(\`[\${request.method}] \${request.url} - \${message} (\${status})\`);

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
`;

class ExceptionFilterGenerator extends Generator {
  protected suffix = 'filter';

  protected getDefaultTemplate(): string {
    return EXCEPTION_FILTER_TEMPLATE;
  }
}

export async function runExceptionFilter(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new ExceptionFilterGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateExceptionFilter(program: Command): void {
  program
    .command('filter <name>')
    .description('Generate a new exception filter')
    .alias('f')
    .option('-p, --path <path>', 'Path where the filter should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runExceptionFilter(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
