import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

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

export async function runGuard(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new GuardGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateGuard(program: Command): void {
  program
    .command('guard <name>')
    .description('Generate a new guard')
    .alias('gu')
    .option('-p, --path <path>', 'Path where the guard should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runGuard(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
