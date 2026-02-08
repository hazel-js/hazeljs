import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const CREATE_DTO_TEMPLATE = `import { IsString, IsOptional } from 'class-validator';

export class Create{{className}}Dto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
`;

const UPDATE_DTO_TEMPLATE = `import { IsString, IsOptional } from 'class-validator';

export class Update{{className}}Dto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
`;

class DtoGenerator extends Generator {
  protected suffix = 'dto';

  protected getDefaultTemplate(): string {
    return CREATE_DTO_TEMPLATE;
  }

  public async generate(options: GeneratorOptions): Promise<void> {
    // Generate create DTO
    await super.generate({
      ...options,
      template: CREATE_DTO_TEMPLATE,
      path: options.path ? `${options.path}/dto` : 'src/dto',
    });

    // Generate update DTO — use a different file name
    const origSuffix = this.suffix;
    this.suffix = 'dto';
    const updateOptions = {
      ...options,
      name: `update-${options.name}`,
      template: UPDATE_DTO_TEMPLATE,
      path: options.path ? `${options.path}/dto` : 'src/dto',
    };
    // Override suffix for the update variant — we prepend "update-" to the name
    // so the file is update-<name>.dto.ts rather than <name>.dto.ts (which would conflict)
    await super.generate(updateOptions);
    this.suffix = origSuffix;
  }
}

export function generateDto(program: Command): void {
  program
    .command('dto <name>')
    .description('Generate create and update DTOs')
    .alias('d')
    .option('-p, --path <path>', 'Path where the DTOs should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new DtoGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
