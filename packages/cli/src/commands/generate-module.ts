import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { Generator, GeneratorOptions } from '../utils/generator';

const MODULE_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
import { {{className}}Controller } from './{{fileName}}.controller';
import { {{className}}Service } from './{{fileName}}.service';

@HazelModule({
  controllers: [{{className}}Controller],
  providers: [{{className}}Service],
})
export class {{className}}Module {}
`;

const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body } from '../../core/decorators';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';

@Controller('/{{fileName}}')
export class {{className}}Controller {
  constructor(private readonly {{fileName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{fileName}}Service.findAll();
  }

  @Post()
  create(@Body() createDto: Create{{className}}Dto) {
    return this.{{fileName}}Service.create(createDto);
  }
}
`;

const SERVICE_TEMPLATE = `import { Injectable } from '../../core/decorators';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';

@Injectable()
export class {{className}}Service {
  private items = [];

  findAll() {
    return this.items;
  }

  create(dto: Create{{className}}Dto) {
    this.items.push(dto);
    return dto;
  }
}
`;

const CREATE_DTO_TEMPLATE = `export class Create{{className}}Dto {
  // Add your properties here
  name: string;
}
`;

const UPDATE_DTO_TEMPLATE = `export class Update{{className}}Dto {
  // Add your properties here
  name?: string;
}
`;

class FullModuleGenerator extends Generator {
  async generate(options: GeneratorOptions): Promise<void> {
    const { name, path: customPath } = options;
    const className = this.toPascalCase(name);
    const fileName = this.toKebabCase(name);
    const baseDir = path.join(process.cwd(), customPath || 'src', fileName);

    // Create module directory and dto subdirectory
    fs.mkdirSync(baseDir, { recursive: true });
    fs.mkdirSync(path.join(baseDir, 'dto'), { recursive: true });

    // Generate files
    fs.writeFileSync(path.join(baseDir, `${fileName}.module.ts`), this.render(MODULE_TEMPLATE, { className, fileName }));
    fs.writeFileSync(path.join(baseDir, `${fileName}.controller.ts`), this.render(CONTROLLER_TEMPLATE, { className, fileName }));
    fs.writeFileSync(path.join(baseDir, `${fileName}.service.ts`), this.render(SERVICE_TEMPLATE, { className, fileName }));
    fs.writeFileSync(path.join(baseDir, 'dto', `create-${fileName}.dto.ts`), this.render(CREATE_DTO_TEMPLATE, { className, fileName }));
    fs.writeFileSync(path.join(baseDir, 'dto', `update-${fileName}.dto.ts`), this.render(UPDATE_DTO_TEMPLATE, { className, fileName }));

    console.log(`✓ Generated module in ${baseDir}`);
  }

  render(template: string, data: Record<string, string>) {
    return template.replace(/{{(\w+)}}/g, (_, key) => data[key] || '');
  }
}

export function generateModule(program: Command): void {
  program
    .command('module <name>')
    .description('Generate a new module (with controller, service, DTOs)')
    .option('-p, --path <path>', 'Path where the module should be generated')
    .action(async (name: string, options: { path?: string }) => {
      const generator = new FullModuleGenerator();
      await generator.generate({ name, path: options.path });
    });
} 