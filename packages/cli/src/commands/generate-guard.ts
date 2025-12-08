import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const GUARD_TEMPLATE = `import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';

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
  protected getDefaultTemplate(): string {
    return GUARD_TEMPLATE;
  }
}

export function generateGuard(program: Command): void {
  program
    .command('guard <name>')
    .description('Generate a new guard')
    .option('-p, --path <path>', 'Path where the guard should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new GuardGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
} 