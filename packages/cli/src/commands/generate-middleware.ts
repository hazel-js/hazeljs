import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const MIDDLEWARE_TEMPLATE = `import { Injectable, type MiddlewareHandler, type Request, type Response, type NextFunction } from '@hazeljs/core';

@Injectable()
export class {{className}}Middleware implements MiddlewareHandler {
  use(req: Request, res: Response, next: NextFunction) {
    // Add your middleware logic here
    console.log(\`[{{className}}Middleware] \${req.method} \${req.url}\`);
    
    // Continue to next middleware
    next();
  }
}
`;

class MiddlewareGenerator extends Generator {
  protected suffix = 'middleware';

  protected getDefaultTemplate(): string {
    return MIDDLEWARE_TEMPLATE;
  }
}

export async function runMiddleware(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new MiddlewareGenerator();
  const result = await generator.generate({ name, path: options.path, dryRun: options.dryRun });
  result.nextSteps = result.nextSteps ?? [];
  result.nextSteps.push('Import the middleware in your module or apply it globally.');
  return result;
}

export function generateMiddleware(command: Command) {
  command
    .command('middleware <name>')
    .alias('mw')
    .description('Generate a middleware')
    .option('-p, --path <path>', 'Specify the path', 'src/middleware')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runMiddleware(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
