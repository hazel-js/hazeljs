import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const REPOSITORY_TEMPLATE = `import { Injectable } from '@hazeljs/core';
import { BaseRepository, PrismaService, PrismaModel } from '@hazeljs/prisma';

@Injectable()
export class {{className}}Repository extends BaseRepository<PrismaModel> {
  constructor(prisma: PrismaService) {
    // Replace 'modelName' with your actual Prisma model name
    super(prisma.modelName as unknown as { findMany: () => Promise<PrismaModel[]>; findUnique: (args: { where: { id?: number } }) => Promise<PrismaModel | null>; create: (args: { data: unknown }) => Promise<PrismaModel>; update: (args: { where: { id?: number }; data: unknown }) => Promise<PrismaModel>; delete: (args: { where: { id?: number } }) => Promise<PrismaModel>; count: (args?: unknown) => Promise<number> });
  }

  // Add custom repository methods here
}
`;

class RepositoryGenerator extends Generator {
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
    .action(async (name: string, options: { path?: string }) => {
      const generator = new RepositoryGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
}

