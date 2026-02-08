import { Command } from 'commander';
import { Generator } from '../utils/generator';

const GUARD_TEMPLATE = `import { Injectable, type CanActivate, type ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Add your guard logic here
    return true;
  }
}
`;

class GuardGenerator extends Generator {
  protected suffix = 'guard';

  protected getDefaultTemplate(): string {
    return GUARD_TEMPLATE;
  }
}

export function generateGuard(program: Command): void {
  program
    .command('guard <name>')
    .description('Generate a new guard')
    .alias('gu')
    .option('-p, --path <path>', 'Path where the guard should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new GuardGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
