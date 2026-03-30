import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { HAZEL_PACKAGES, findPackage } from '../utils/packages-registry';
import { toKebabCase } from '../utils/generator';

export function addCommand(program: Command) {
  program
    .command('add [package]')
    .description('Add a HazelJS package to your project (optionally generate a setup file with --setup)')
    .option('--dev', 'Install as dev dependency')
    .option('--setup', 'Also generate a minimal setup/starter file in src/')
    .option('--setup-path <path>', 'Path for the setup file', 'src')
    .action(async (packageName?: string, options?: { dev?: boolean; setup?: boolean; setupPath?: string }) => {
      try {
        let selectedPackage = packageName;

        // If no package specified, show interactive selection
        if (!selectedPackage) {
          const { package: pkg } = await inquirer.prompt([
            {
              type: 'list',
              name: 'package',
              message: 'Which HazelJS package would you like to add?',
              choices: HAZEL_PACKAGES.map((p) => ({
                name: `${p.shortName} - ${p.npm}`,
                value: p.shortName,
              })),
            },
          ]);
          selectedPackage = pkg;
        }

        // Get the package info
        const pkgInfo = findPackage(selectedPackage as string);

        if (!pkgInfo) {
          console.log(chalk.yellow(`Unknown package: ${selectedPackage}`));
          console.log(chalk.gray('\nAvailable packages:'));
          HAZEL_PACKAGES.forEach((p) => {
            console.log(chalk.gray(`  - ${p.shortName}: ${p.npm}`));
          });
          return;
        }

        console.log(chalk.blue(`\n\uD83D\uDCE6 Installing ${pkgInfo.npm}...`));

        const devFlag = options?.dev ? '--save-dev' : '';
        const command = `npm install ${pkgInfo.npm} ${devFlag}`.trim();

        execSync(command, { stdio: 'inherit' });

        console.log(chalk.green(`\n\u2713 Successfully installed ${pkgInfo.npm}`));

        // Generate setup file if requested
        if (options?.setup && pkgInfo.setupTemplate) {
          const setupDir = path.join(process.cwd(), options.setupPath || 'src');
          const setupFile = path.join(setupDir, `${toKebabCase(pkgInfo.shortName)}.setup.ts`);
          if (!fs.existsSync(setupDir)) fs.mkdirSync(setupDir, { recursive: true });
          fs.writeFileSync(setupFile, pkgInfo.setupTemplate);
          console.log(chalk.green(`\u2713 Generated setup file: ${setupFile}`));
        } else if (options?.setup && !pkgInfo.setupTemplate) {
          console.log(chalk.gray('\nNo setup template available for this package.'));
        }

        // Show usage hints
        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray(`  ${pkgInfo.hint}`));
        console.log(
          chalk.gray(`\nDocumentation: https://hazeljs.ai/docs/packages/${pkgInfo.shortName}`)
        );
      } catch (error) {
        console.error(chalk.red('Error installing package:'), error);
        process.exit(1);
      }
    });
}
