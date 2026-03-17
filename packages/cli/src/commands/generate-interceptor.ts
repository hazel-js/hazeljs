import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const INTERCEPTOR_TEMPLATE = `import { Injectable, Interceptor, type ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Interceptor implements Interceptor {
  async intercept(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    // Pre-processing logic here (before handler execution)
    const result = await next();
    // Post-processing logic here (after handler execution)
    return result;
  }
}
`;

class InterceptorGenerator extends Generator {
  protected suffix = 'interceptor';

  protected getDefaultTemplate(): string {
    return INTERCEPTOR_TEMPLATE;
  }
}

export async function runInterceptor(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new InterceptorGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateInterceptor(program: Command): void {
  program
    .command('interceptor <name>')
    .description('Generate a new interceptor')
    .alias('i')
    .option('-p, --path <path>', 'Path where the interceptor should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runInterceptor(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
