import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import mustache from 'mustache';

/**
 * Shared string transformation utilities
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function renderTemplate(template: string, data: Record<string, string>): string {
  return mustache.render(template, data);
}

export interface GeneratorOptions {
  name: string;
  path?: string;
  template?: string;
  data?: Record<string, unknown>;
  dryRun?: boolean;
}

/** Result of a generation run for machine-readable output (e.g. --json) */
export interface GenerateResult {
  ok: boolean;
  created: string[];
  nextSteps?: string[];
  dryRun?: boolean;
  error?: string;
}

/** Common CLI options for all generate commands */
export interface GenerateCLIOptions {
  path?: string;
  dryRun?: boolean;
  json?: boolean;
  route?: string;
  platform?: string;
}

export class Generator {
  /**
   * File suffix appended before .ts (e.g. 'controller' -> name.controller.ts)
   * Override in subclasses.
   */
  protected suffix = '';

  public async generate(options: GeneratorOptions): Promise<GenerateResult> {
    const { name, path: customPath, template, data = {}, dryRun = false } = options;

    // Get the template
    const templateContent = template || this.getDefaultTemplate();

    // Prepare the data
    const templateData = {
      name,
      className: toPascalCase(name),
      fileName: toKebabCase(name),
      camelName: toCamelCase(name),
      ...data,
    };

    // Render the template
    const content = mustache.render(templateContent, templateData);

    // Determine the file path
    const filePath = this.getFilePath(name, customPath);
    const created: string[] = [filePath];

    if (dryRun) {
      return { ok: true, created, dryRun: true };
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content);

    return { ok: true, created };
  }

  protected getFilePath(name: string, customPath?: string): string {
    const fileName = toKebabCase(name);
    const basePath = customPath || 'src';
    const suffix = this.suffix ? `.${this.suffix}` : '';
    return path.join(process.cwd(), basePath, `${fileName}${suffix}.ts`);
  }

  protected getDefaultTemplate(): string {
    return '';
  }

  public async promptForOptions(options: Partial<GeneratorOptions>): Promise<GeneratorOptions> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the component?',
        when: !options.name,
      },
      {
        type: 'input',
        name: 'path',
        message: 'Where should the component be generated?',
        default: 'src',
        when: !options.path,
      },
    ]);

    return {
      ...options,
      ...answers,
    };
  }
}

/** Output result for humans or as JSON. Use json: true to print a single JSON object to stdout. */
export function printGenerateResult(result: GenerateResult, options: { json?: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(result));
    return;
  }
  if (!result.ok) {
    console.error(chalk.red(result.error ?? 'Generation failed'));
    return;
  }
  const prefix = result.dryRun ? chalk.blue('[dry-run] Would create ') : chalk.green('✓ Generated ');
  for (const file of result.created) {
    console.log(prefix + file);
  }
  if (result.nextSteps && result.nextSteps.length > 0) {
    console.log(chalk.blue('\nNext steps:'));
    result.nextSteps.forEach((step) => console.log(chalk.gray('  ' + step)));
  }
}
