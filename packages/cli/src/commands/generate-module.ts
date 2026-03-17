import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { toPascalCase, toKebabCase, renderTemplate, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

const MODULE_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
import { {{className}}Controller } from './{{fileName}}.controller';
import { {{className}}Service } from './{{fileName}}.service';

@HazelModule({
  controllers: [{{className}}Controller],
  providers: [{{className}}Service],
})
export class {{className}}Module {}
`;

const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';

@Controller('/{{fileName}}')
export class {{className}}Controller {
  constructor(private readonly {{camelName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{camelName}}Service.findAll();
  }

  @Post()
  create(@Body() createDto: Create{{className}}Dto) {
    return this.{{camelName}}Service.create(createDto);
  }
}
`;

const SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';

@Service()
export class {{className}}Service {
  private items: any[] = [];

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

export async function runModule(name: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const className = toPascalCase(name);
  const fileName = toKebabCase(name);
  const camelName = fileName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const baseDir = path.join(process.cwd(), options.path || 'src', fileName);
  const data = { className, fileName, camelName };

  const files = [
    { file: `${fileName}.module.ts`, template: MODULE_TEMPLATE },
    { file: `${fileName}.controller.ts`, template: CONTROLLER_TEMPLATE },
    { file: `${fileName}.service.ts`, template: SERVICE_TEMPLATE },
    { file: `dto/create-${fileName}.dto.ts`, template: CREATE_DTO_TEMPLATE },
    { file: `dto/update-${fileName}.dto.ts`, template: UPDATE_DTO_TEMPLATE },
  ];

  const created: string[] = [];
  for (const { file, template } of files) {
    const filePath = path.join(baseDir, file);
    created.push(filePath);
    if (options.dryRun) continue;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, renderTemplate(template, data));
  }
  return {
    ok: true,
    created,
    dryRun: options.dryRun,
    nextSteps: [`Import ${className}Module in your app module.`],
  };
}

export function generateModule(program: Command): void {
  program
    .command('module <name>')
    .description('Generate a new module (with controller, service, DTOs)')
    .alias('m')
    .option('-p, --path <path>', 'Path where the module should be generated')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (name: string, options: GenerateCLIOptions) => {
      const result = await runModule(name, options);
      printGenerateResult(result, { json: options.json });
    });
}
