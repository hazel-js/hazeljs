import { Command } from 'commander';
import { Generator } from '../utils/generator';

const PIPE_TEMPLATE = `import { type PipeTransform, type RequestContext } from '@hazeljs/core';

export class {{className}}Pipe implements PipeTransform {
  transform(value: unknown, context: RequestContext): unknown {
    // Transform logic here
    return value;
  }
}
`;

class PipeGenerator extends Generator {
  protected suffix = 'pipe';

  protected getDefaultTemplate(): string {
    return PIPE_TEMPLATE;
  }
}

export function generatePipe(program: Command): void {
  program
    .command('pipe <name>')
    .description('Generate a new pipe')
    .option('-p, --path <path>', 'Path where the pipe should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new PipeGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
