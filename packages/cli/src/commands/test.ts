import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export function testCommand(program: Command) {
  program
    .command('test [pattern]')
    .description('Run tests')
    .option('-w, --watch', 'Watch mode')
    .option('-c, --coverage', 'Generate coverage report')
    .option('--ci', 'Run in CI mode')
    .action((pattern?: string, options?: { watch?: boolean; coverage?: boolean; ci?: boolean }) => {
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          console.log(chalk.red('✗ No package.json found'));
          console.log(chalk.gray('Run this command from your project root'));
          process.exit(1);
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        if (!packageJson.scripts?.test) {
          console.log(chalk.yellow('⚠ No test script found in package.json'));
          console.log(chalk.gray('\nAdd a test script to your package.json:'));
          console.log(chalk.gray('  "scripts": {'));
          console.log(chalk.gray('    "test": "jest"'));
          console.log(chalk.gray('  }'));
          process.exit(1);
        }

        console.log(chalk.blue('🧪 Running tests...\n'));

        let command = 'npm test';
        const args: string[] = [];

        if (pattern) {
          args.push(pattern);
        }

        if (options?.watch) {
          args.push('--watch');
        }

        if (options?.coverage) {
          args.push('--coverage');
        }

        if (options?.ci) {
          command = packageJson.scripts['test:ci'] ? 'npm run test:ci' : 'npm test -- --ci';
        }

        if (args.length > 0 && !options?.ci) {
          command += ' -- ' + args.join(' ');
        }

        execSync(command, { stdio: 'inherit' });

        if (!options?.watch) {
          console.log(chalk.green('\n✓ Tests completed'));
        }
      } catch {
        console.error(chalk.red('\n✗ Tests failed'));
        process.exit(1);
      }
    });
}
