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

const UPDATE_DTO_TEMPLATE = `import { PartialType } from '@hazeljs/core';
import { Create{{className}}Dto } from './create-{{fileName}}.dto';

export class Update{{className}}Dto extends PartialType(Create{{className}}Dto) {}
`;

class DtoGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return CREATE_DTO_TEMPLATE;
  }

  public async generate(options: GeneratorOptions): Promise<void> {
    // Generate create DTO
    const createDtoOptions = {
      ...options,
      template: CREATE_DTO_TEMPLATE,
      path: options.path ? `${options.path}/dto` : 'src/dto',
    };
    await super.generate(createDtoOptions);

    // Generate update DTO
    const updateDtoOptions = {
      ...options,
      template: UPDATE_DTO_TEMPLATE,
      path: options.path ? `${options.path}/dto` : 'src/dto',
    };
    await super.generate(updateDtoOptions);
  }
}

export function generateDto(program: Command): void {
  program
    .command('dto <name>')
    .description('Generate create and update DTOs')
    .option('-p, --path <path>', 'Path where the DTOs should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new DtoGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
} 