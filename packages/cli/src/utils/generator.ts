import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import mustache from 'mustache';

export interface GeneratorOptions {
  name: string;
  path?: string;
  template?: string;
  data?: Record<string, unknown>;
}

export class Generator {
  public async generate(options: GeneratorOptions): Promise<void> {
    const { name, path: customPath, template, data = {} } = options;

    // Get the template
    const templateContent = template || this.getDefaultTemplate();

    // Prepare the data
    const templateData = {
      name,
      className: this.toPascalCase(name),
      fileName: this.toKebabCase(name),
      ...data,
    };

    // Render the template
    const content = mustache.render(templateContent, templateData);

    // Determine the file path
    const filePath = this.getFilePath(name, customPath);

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content);

    console.log(chalk.green(`✓ Generated ${filePath}`));
  }

  protected toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  protected getFilePath(name: string, customPath?: string): string {
    const fileName = this.toKebabCase(name);
    const basePath = customPath || 'src';
    return path.join(process.cwd(), basePath, `${fileName}.ts`);
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