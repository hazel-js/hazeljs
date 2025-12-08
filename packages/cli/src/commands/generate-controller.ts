import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body, Param, Delete, Put } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';
import { Update{{className}}Dto } from './dto/update-{{fileName}}.dto';

@Controller('{{fileName}}')
export class {{className}}Controller {
  constructor(private readonly {{fileName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{fileName}}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.{{fileName}}Service.findOne(id);
  }

  @Post()
  create(@Body(Create{{className}}Dto) create{{className}}Dto: Create{{className}}Dto) {
    return this.{{fileName}}Service.create(create{{className}}Dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(Update{{className}}Dto) update{{className}}Dto: Update{{className}}Dto) {
    return this.{{fileName}}Service.update(id, update{{className}}Dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.{{fileName}}Service.remove(id);
  }
}
`;

class ControllerGenerator extends Generator {
  protected getDefaultTemplate(): string {
    return CONTROLLER_TEMPLATE;
  }
}

export function generateController(program: Command): void {
  program
    .command('controller <name>')
    .description('Generate a new controller')
    .option('-p, --path <path>', 'Path where the controller should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new ControllerGenerator();
      const generatorOptions: Partial<GeneratorOptions> = {
        name,
        path: options.path,
      };

      const finalOptions = await generator.promptForOptions(generatorOptions);
      await generator.generate(finalOptions);
    });
} 