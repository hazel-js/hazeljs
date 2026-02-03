import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export function startCommand(program: Command) {
  program
    .command('start')
    .description('Start the HazelJS application')
    .option('-d, --dev', 'Start in development mode')
    .option('-p, --port <port>', 'Specify port')
    .action((options: { dev?: boolean; port?: string }) => {
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          console.log(chalk.red('✗ No package.json found'));
          console.log(chalk.gray('Run this command from your project root'));
          process.exit(1);
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        let command: string;

        if (options.dev) {
          if (!packageJson.scripts?.dev) {
            console.log(chalk.yellow('⚠ No dev script found in package.json'));
            console.log(chalk.gray('\nAdd a dev script to your package.json:'));
            console.log(chalk.gray('  "scripts": {'));
            console.log(chalk.gray('    "dev": "ts-node-dev --respawn src/index.ts"'));
            console.log(chalk.gray('  }'));
            process.exit(1);
          }
          command = 'npm run dev';
          console.log(chalk.blue('🚀 Starting in development mode...\n'));
        } else {
          if (!packageJson.scripts?.start) {
            console.log(chalk.yellow('⚠ No start script found in package.json'));
            console.log(chalk.gray('\nAdd a start script to your package.json:'));
            console.log(chalk.gray('  "scripts": {'));
            console.log(chalk.gray('    "start": "node dist/index.js"'));
            console.log(chalk.gray('  }'));
            process.exit(1);
          }
          command = 'npm start';
          console.log(chalk.blue('🚀 Starting application...\n'));
        }

        if (options.port) {
          process.env.PORT = options.port;
        }

        execSync(command, { stdio: 'inherit' });
      } catch {
        console.error(chalk.red('\n✗ Failed to start application'));
        process.exit(1);
      }
    });
}
