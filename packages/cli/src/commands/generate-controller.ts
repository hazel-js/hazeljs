import { Command } from 'commander';
import { Generator } from '../utils/generator';

const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body, Param, Delete, Put } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';
import { Update{{className}}Dto } from './dto/update-{{fileName}}.dto';

@Controller('{{fileName}}')
export class {{className}}Controller {
  constructor(private readonly {{camelName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{camelName}}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.{{camelName}}Service.findOne(id);
  }

  @Post()
  create(@Body(Create{{className}}Dto) createDto: Create{{className}}Dto) {
    return this.{{camelName}}Service.create(createDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(Update{{className}}Dto) updateDto: Update{{className}}Dto) {
    return this.{{camelName}}Service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.{{camelName}}Service.remove(id);
  }
}
`;

class ControllerGenerator extends Generator {
  protected suffix = 'controller';

  protected getDefaultTemplate(): string {
    return CONTROLLER_TEMPLATE;
  }
}

export function generateController(program: Command): void {
  program
    .command('controller <name>')
    .description('Generate a new controller')
    .alias('c')
    .option('-p, --path <path>', 'Path where the controller should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .action(async (name: string, options: { path?: string; dryRun?: boolean }) => {
      const generator = new ControllerGenerator();
      await generator.generate({ name, path: options.path, dryRun: options.dryRun });
    });
}
