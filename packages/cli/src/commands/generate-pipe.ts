import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const PIPE_TEMPLATE = `import { PipeTransform, RequestContext } from '@hazeljs/core';

export class {{className}}Pipe implements PipeTransform {
  transform(value: unknown, context: RequestContext): unknown {
    // Transform logic here
    return value;
  }
}
`;

class PipeGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return PIPE_TEMPLATE;
  }
}

export function generatePipe(program: Command): void {
  program
    .command('pipe <name>')
    .description('Generate a new pipe')
    .option('-p, --path <path>', 'Path where the pipe should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new PipeGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
}

