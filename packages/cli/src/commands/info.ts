import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Register the `hazel info` command.
 *
 * Reads the current directory's package.json and displays:
 * - Project name, version, description
 * - Installed @hazeljs/* packages with versions
 * - src/ directory listing
 * - Node.js version, platform, architecture
 * - Detected configuration files (tsconfig, .env, eslint, etc.)
 *
 * @param program - The root Commander program instance
 */
export function infoCommand(program: Command) {
  program
    .command('info')
    .description('Display information about the current HazelJS project')
    .action(() => {
      try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          console.log(chalk.yellow('⚠ No package.json found in current directory'));
          console.log(chalk.gray('This does not appear to be a Node.js project'));
          return;
        }

        const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        console.log(chalk.bold.blue('\n📦 Project Information\n'));

        // Basic info
        console.log(chalk.bold('Name:'), packageJson.name || 'N/A');
        console.log(chalk.bold('Version:'), packageJson.version || 'N/A');
        console.log(chalk.bold('Description:'), packageJson.description || 'N/A');

        // HazelJS packages
        const hazelPackages: string[] = [];
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        Object.keys(allDeps).forEach((dep) => {
          if (dep.startsWith('@hazeljs/')) {
            hazelPackages.push(`${dep}@${allDeps[dep]}`);
          }
        });

        if (hazelPackages.length > 0) {
          console.log(chalk.bold('\n🔧 HazelJS Packages:\n'));
          hazelPackages.forEach((pkg) => {
            console.log(chalk.green('  ✓'), pkg);
          });
        } else {
          console.log(chalk.yellow('\n⚠ No HazelJS packages found'));
          console.log(chalk.gray('Install HazelJS packages with: npm install @hazeljs/core'));
        }

        // Project structure
        console.log(chalk.bold('\n📁 Project Structure:\n'));
        const srcPath = path.join(process.cwd(), 'src');
        if (fs.existsSync(srcPath)) {
          const items = fs.readdirSync(srcPath);
          items.forEach((item) => {
            const itemPath = path.join(srcPath, item);
            const stat = fs.statSync(itemPath);
            const icon = stat.isDirectory() ? '📁' : '📄';
            console.log(`  ${icon} ${item}`);
          });
        } else {
          console.log(chalk.gray('  No src directory found'));
        }

        // Environment
        console.log(chalk.bold('\n🌍 Environment:\n'));
        console.log(chalk.bold('Node:'), process.version);
        console.log(chalk.bold('Platform:'), process.platform);
        console.log(chalk.bold('Architecture:'), process.arch);

        // Config files
        console.log(chalk.bold('\n⚙️  Configuration Files:\n'));
        const configFiles = [
          'tsconfig.json',
          '.env',
          '.env.example',
          '.eslintrc.js',
          '.prettierrc',
          'jest.config.js',
        ];

        configFiles.forEach((file) => {
          const exists = fs.existsSync(path.join(process.cwd(), file));
          const icon = exists ? chalk.green('✓') : chalk.gray('✗');
          console.log(`  ${icon} ${file}`);
        });

        console.log('');
      } catch (error) {
        console.error(chalk.red('Error reading project information:'), error);
        process.exit(1);
      }
    });
}
