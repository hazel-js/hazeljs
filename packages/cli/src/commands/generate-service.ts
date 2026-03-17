import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';

@Service()
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

export async function runService(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new ServiceGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateService(program: Command): void {
  program
    .command('service <name>')
    .description('Generate a new service')
    .alias('s')
    .option('-p, --path <path>', 'Path where the service should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runService(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
