import { Command } from 'commander';
import { Generator, GeneratorOptions, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

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

  public async generate(options: GeneratorOptions): Promise<GenerateResult> {
    // Generate create DTO
    const r1 = await super.generate({
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
    const r2 = await super.generate(updateOptions);
    this.suffix = origSuffix;

    return {
      ok: r1.ok && r2.ok,
      created: [...(r1.created ?? []), ...(r2.created ?? [])],
      dryRun: r1.dryRun ?? r2.dryRun,
    };
  }
}

export async function runDto(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const generator = new DtoGenerator();
  return generator.generate({ name, path: options.path, dryRun: options.dryRun });
}

export function generateDto(program: Command): void {
  program
    .command('dto <name>')
    .description('Generate create and update DTOs')
    .alias('d')
    .option('-p, --path <path>', 'Path where the DTOs should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runDto(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
