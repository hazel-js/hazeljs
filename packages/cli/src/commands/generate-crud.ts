import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const controllerTemplate = `import { Controller, Get, Post, Put, Delete, Body, Param } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto, Update{{className}}Dto } from './dto/{{fileName}}.dto';

@Controller('/{{routePath}}')
export class {{className}}Controller {
  constructor(private {{camelName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{camelName}}Service.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.{{camelName}}Service.findOne(id);
  }

  @Post()
  create(@Body() createDto: Create{{className}}Dto) {
    return this.{{camelName}}Service.create(createDto);
  }

  @Put('/:id')
  update(@Param('id') id: string, @Body() updateDto: Update{{className}}Dto) {
    return this.{{camelName}}Service.update(id, updateDto);
  }

  @Delete('/:id')
  delete(@Param('id') id: string) {
    return this.{{camelName}}Service.delete(id);
  }
}
`;

const serviceTemplate = `import { Injectable } from '@hazeljs/core';
import { Create{{className}}Dto, Update{{className}}Dto } from './dto/{{fileName}}.dto';

@Injectable()
export class {{className}}Service {
  private {{camelName}}s: any[] = [];

  findAll() {
    return this.{{camelName}}s;
  }

  findOne(id: string) {
    const {{camelName}} = this.{{camelName}}s.find(item => item.id === id);
    if (!{{camelName}}) {
      throw new Error('{{className}} not found');
    }
    return {{camelName}};
  }

  create(createDto: Create{{className}}Dto) {
    const {{camelName}} = {
      id: Date.now().toString(),
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.{{camelName}}s.push({{camelName}});
    return {{camelName}};
  }

  update(id: string, updateDto: Update{{className}}Dto) {
    const index = this.{{camelName}}s.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('{{className}} not found');
    }
    this.{{camelName}}s[index] = {
      ...this.{{camelName}}s[index],
      ...updateDto,
      updatedAt: new Date(),
    };
    return this.{{camelName}}s[index];
  }

  delete(id: string) {
    const index = this.{{camelName}}s.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error('{{className}} not found');
    }
    const deleted = this.{{camelName}}s.splice(index, 1);
    return deleted[0];
  }
}
`;

const dtoTemplate = `import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class Create{{className}}Dto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class Update{{className}}Dto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
`;

const moduleTemplate = `import { HazelModule } from '@hazeljs/core';
import { {{className}}Controller } from './{{fileName}}.controller';
import { {{className}}Service } from './{{fileName}}.service';

@HazelModule({
  controllers: [{{className}}Controller],
  providers: [{{className}}Service],
})
export class {{className}}Module {}
`;

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

export function generateCrud(command: Command) {
  command
    .command('crud <name>')
    .description('Generate a complete CRUD resource (controller, service, module, DTOs)')
    .option('-p, --path <path>', 'Specify the path', 'src')
    .option('-r, --route <route>', 'Specify the route path')
    .action((name: string, options: { path?: string; route?: string }) => {
      const className = toPascalCase(name);
      const fileName = toKebabCase(name);
      const camelName = toCamelCase(name);
      const routePath = options.route || fileName;
      const basePath = path.join(process.cwd(), options.path || 'src', fileName);

      const data = {
        className,
        fileName,
        camelName,
        routePath,
      };

      try {
        // Create directory
        if (!fs.existsSync(basePath)) {
          fs.mkdirSync(basePath, { recursive: true });
        }

        // Create DTO directory
        const dtoPath = path.join(basePath, 'dto');
        if (!fs.existsSync(dtoPath)) {
          fs.mkdirSync(dtoPath, { recursive: true });
        }

        // Generate controller
        const controllerPath = path.join(basePath, `${fileName}.controller.ts`);
        fs.writeFileSync(controllerPath, renderTemplate(controllerTemplate, data));
        console.log(chalk.green(`✓ Generated ${controllerPath}`));

        // Generate service
        const servicePath = path.join(basePath, `${fileName}.service.ts`);
        fs.writeFileSync(servicePath, renderTemplate(serviceTemplate, data));
        console.log(chalk.green(`✓ Generated ${servicePath}`));

        // Generate DTOs
        const dtoFilePath = path.join(dtoPath, `${fileName}.dto.ts`);
        fs.writeFileSync(dtoFilePath, renderTemplate(dtoTemplate, data));
        console.log(chalk.green(`✓ Generated ${dtoFilePath}`));

        // Generate module
        const modulePath = path.join(basePath, `${fileName}.module.ts`);
        fs.writeFileSync(modulePath, renderTemplate(moduleTemplate, data));
        console.log(chalk.green(`✓ Generated ${modulePath}`));

        console.log(chalk.blue('\n📦 CRUD resource generated successfully!'));
        console.log(chalk.gray(`\nNext steps:`));
        console.log(chalk.gray(`1. Import ${className}Module in your app module`));
        console.log(chalk.gray(`2. Customize the DTOs in ${dtoFilePath}`));
        console.log(chalk.gray(`3. Implement your business logic in ${servicePath}`));
      } catch (error) {
        console.error(chalk.red('Error generating CRUD resource:'), error);
        process.exit(1);
      }
    });
}
