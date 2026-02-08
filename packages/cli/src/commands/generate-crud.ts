import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { toPascalCase, toKebabCase, toCamelCase, renderTemplate } from '../utils/generator';

const controllerTemplate = `import { Controller, Get, Post, Put, Delete, Body, Param } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto, Update{{className}}Dto } from './dto/{{fileName}}.dto';

@Controller('/{{{routePath}}}')
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

export function generateCrud(command: Command) {
  command
    .command('crud <name>')
    .description('Generate a complete CRUD resource (controller, service, module, DTOs)')
    .option('-p, --path <path>', 'Specify the path', 'src')
    .option('-r, --route <route>', 'Specify the route path')
    .option('--dry-run', 'Preview files without writing them')
    .action((name: string, options: { path?: string; route?: string; dryRun?: boolean }) => {
      const className = toPascalCase(name);
      const fileName = toKebabCase(name);
      const camelName = toCamelCase(name);
      const routePath = options.route || fileName;
      const basePath = path.join(process.cwd(), options.path || 'src', fileName);

      const data = { className, fileName, camelName, routePath };

      const files = [
        { file: `${fileName}.controller.ts`, template: controllerTemplate },
        { file: `${fileName}.service.ts`, template: serviceTemplate },
        { file: `dto/${fileName}.dto.ts`, template: dtoTemplate },
        { file: `${fileName}.module.ts`, template: moduleTemplate },
      ];

      try {
        for (const { file, template } of files) {
          const filePath = path.join(basePath, file);

          if (options.dryRun) {
            console.log(chalk.blue(`[dry-run] Would create ${filePath}`));
            continue;
          }

          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, renderTemplate(template, data));
          console.log(chalk.green(`\u2713 Generated ${filePath}`));
        }

        if (!options.dryRun) {
          console.log(chalk.blue('\n\uD83D\uDCE6 CRUD resource generated successfully!'));
          console.log(chalk.gray(`\nNext steps:`));
          console.log(chalk.gray(`1. Import ${className}Module in your app module`));
          console.log(chalk.gray(`2. Customize the DTOs`));
          console.log(chalk.gray(`3. Implement your business logic in the service`));
        }
      } catch (error) {
        console.error(chalk.red('Error generating CRUD resource:'), error);
        process.exit(1);
      }
    });
}
