import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const middlewareTemplate = `import { Request, Response, NextFunction } from 'express';
import { Injectable } from '@hazeljs/core';

@Injectable()
export class {{className}}Middleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Add your middleware logic here
    console.log(\`[{{className}}Middleware] \${req.method} \${req.path}\`);
    
    // Example: Add custom header
    res.setHeader('X-{{className}}', 'true');
    
    // Continue to next middleware
    next();
  }
}
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

function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

export function generateMiddleware(command: Command) {
  command
    .command('middleware <name>')
    .alias('mw')
    .description('Generate a middleware')
    .option('-p, --path <path>', 'Specify the path', 'src/middleware')
    .action((name: string, options: { path?: string }) => {
      const className = toPascalCase(name);
      const fileName = toKebabCase(name);
      const filePath = path.join(
        process.cwd(),
        options.path || 'src/middleware',
        `${fileName}.middleware.ts`
      );

      const data = {
        className,
        fileName,
      };

      try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Generate middleware
        fs.writeFileSync(filePath, renderTemplate(middlewareTemplate, data));
        console.log(chalk.green(`✓ Generated ${filePath}`));

        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray(`import { ${className}Middleware } from './${options.path?.replace('src/', '') || 'middleware'}/${fileName}.middleware';`));
        console.log(chalk.gray(`\n// In your module:`));
        console.log(chalk.gray(`@HazelModule({`));
        console.log(chalk.gray(`  providers: [${className}Middleware],`));
        console.log(chalk.gray(`})`));
        console.log(chalk.gray(`\n// Or apply globally in main.ts:`));
        console.log(chalk.gray(`app.use(new ${className}Middleware().use);`));
      } catch (error) {
        console.error(chalk.red('Error generating middleware:'), error);
        process.exit(1);
      }
    });
}
