import { Command } from 'commander';
import { Generator } from '../utils/generator';

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

  async create(createDto: any) {
    return createDto;
  }

  async update(id: string, updateDto: any) {
    return { id, ...updateDto };
  }

  async remove(id: string) {
    return { id };
  }
}
`;

class ServiceGenerator extends Generator {
  protected suffix = 'service';

  protected getDefaultTemplate(): string {
    return SERVICE_TEMPLATE;
  }
}

export function generateService(program: Command): void {
  program
    .command('service <name>')
    .description('Generate a new service')
    .alias('s')
    .option('-p, --path <path>', 'Path where the service should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new ServiceGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
