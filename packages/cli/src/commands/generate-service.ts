import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const SERVICE_TEMPLATE = `import { Injectable } from '@hazeljs/core';

@Injectable()
export class {{className}}Service {
  constructor() {}

  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(create{{className}}Dto: any) {
    return create{{className}}Dto;
  }

  async update(id: string, update{{className}}Dto: any) {
    return { id, ...update{{className}}Dto };
  }

  async remove(id: string) {
    return { id };
  }
}
`;

class ServiceGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return SERVICE_TEMPLATE;
  }
}

export function generateService(program: Command): void {
  program
    .command('service <name>')
    .description('Generate a new service')
    .option('-p, --path <path>', 'Path where the service should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new ServiceGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
} 