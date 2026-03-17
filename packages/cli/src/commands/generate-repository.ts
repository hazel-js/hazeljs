import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const REPOSITORY_TEMPLATE = `import { Repository, BaseRepository, PrismaService } from '@hazeljs/prisma';

// @Repository implies @Injectable() — no need for both decorators
@Repository({ model: '{{modelName}}' })
export class {{className}}Repository extends BaseRepository<any> {
  constructor(prisma: PrismaService) {
    super(prisma, '{{modelName}}');
  }

  // Add custom repository methods here
  async findByName(name: string) {
    return this.findMany({ where: { name } });
  }
}
`;

class RepositoryGenerator extends Generator {
  protected suffix = 'repository';

  protected getDefaultTemplate(): string {
    return REPOSITORY_TEMPLATE;
  }
}

export async function runRepository(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new RepositoryGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateRepository(program: Command): void {
  program
    .command('repository <name>')
    .description('Generate a new Prisma repository')
    .alias('repo')
    .option('-p, --path <path>', 'Path where the repository should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runRepository(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
