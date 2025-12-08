import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const EXCEPTION_FILTER_TEMPLATE = `import { Catch, ExceptionFilter, ArgumentsHost, HttpError } from '@hazeljs/core';
import logger from '@hazeljs/core';

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
      ...(exception.errors && { errors: exception.errors }),
    });
  }
}
`;

class ExceptionFilterGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return EXCEPTION_FILTER_TEMPLATE;
  }
}

export function generateExceptionFilter(program: Command): void {
  program
    .command('filter <name>')
    .description('Generate a new exception filter')
    .alias('f')
    .option('-p, --path <path>', 'Path where the filter should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new ExceptionFilterGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
}

