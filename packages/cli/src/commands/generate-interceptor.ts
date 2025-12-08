import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const INTERCEPTOR_TEMPLATE = `import { Injectable, Interceptor, ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Interceptor implements Interceptor {
  async intercept(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    // Pre-processing logic here (before handler execution)
    const result = await next();
    // Post-processing logic here (after handler execution)
    // Transform the response data here
    return result;
  }
}
`;

class InterceptorGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return INTERCEPTOR_TEMPLATE;
  }
}

export function generateInterceptor(program: Command): void {
  program
    .command('interceptor <name>')
    .description('Generate a new interceptor')
    .option('-p, --path <path>', 'Path where the interceptor should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new InterceptorGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
} 