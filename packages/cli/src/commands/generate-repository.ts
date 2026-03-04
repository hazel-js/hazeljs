import { Command } from 'commander';
import { Generator } from '../utils/generator';

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

export function generateRepository(program: Command): void {
  program
    .command('repository <name>')
    .description('Generate a new Prisma repository')
    .alias('repo')
    .option('-p, --path <path>', 'Path where the repository should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new RepositoryGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
