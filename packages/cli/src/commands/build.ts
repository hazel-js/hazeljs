import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export function buildCommand(program: Command) {
  program
    .command('build')
    .description('Build the HazelJS project')
    .option('-w, --watch', 'Watch mode')
    .option('-p, --production', 'Production build')
    .action((options: { watch?: boolean; production?: boolean }) => {
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          console.log(chalk.red('✗ No package.json found'));
          console.log(chalk.gray('Run this command from your project root'));
          process.exit(1);
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        if (!packageJson.scripts?.build) {
          console.log(chalk.yellow('⚠ No build script found in package.json'));
          console.log(chalk.gray('\nAdd a build script to your package.json:'));
          console.log(chalk.gray('  "scripts": {'));
          console.log(chalk.gray('    "build": "tsc"'));
          console.log(chalk.gray('  }'));
          process.exit(1);
        }

        console.log(chalk.blue('🔨 Building project...\n'));

        let command = 'npm run build';

        if (options.watch) {
          command = 'npm run build -- --watch';
        }

        if (options.production) {
          process.env.NODE_ENV = 'production';
        }

        execSync(command, { stdio: 'inherit' });

        if (!options.watch) {
          console.log(chalk.green('\n✓ Build completed successfully'));
        }
      } catch {
        console.error(chalk.red('\n✗ Build failed'));
        process.exit(1);
      }
    });
}
