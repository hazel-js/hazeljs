import { Command } from 'commander';
import { Generator } from '../utils/generator';
import chalk from 'chalk';

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

export function generateMiddleware(command: Command) {
  command
    .command('middleware <name>')
    .alias('mw')
    .description('Generate a middleware')
    .option('-p, --path <path>', 'Specify the path', 'src/middleware')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new MiddlewareGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });

      if (!options.dryRun) {
        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray(`  Import the middleware in your module or apply it globally.`));
      }
    });
}
