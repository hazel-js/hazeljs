import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

const HAZEL_PACKAGES = {
  ai: '@hazeljs/ai',
  auth: '@hazeljs/auth',
  cache: '@hazeljs/cache',
  config: '@hazeljs/config',
  cron: '@hazeljs/cron',
  prisma: '@hazeljs/prisma',
  rag: '@hazeljs/rag',
  serverless: '@hazeljs/serverless',
  swagger: '@hazeljs/swagger',
  websocket: '@hazeljs/websocket',
  discovery: '@hazeljs/discovery',
};

export function addCommand(program: Command) {
  program
    .command('add [package]')
    .description('Add a HazelJS package to your project')
    .option('--dev', 'Install as dev dependency')
    .action(async (packageName?: string, options?: { dev?: boolean }) => {
      try {
        let selectedPackage = packageName;

        // If no package specified, show interactive selection
        if (!selectedPackage) {
          const { package: pkg } = await inquirer.prompt([
            {
              type: 'list',
              name: 'package',
              message: 'Which HazelJS package would you like to add?',
              choices: Object.keys(HAZEL_PACKAGES).map((key) => ({
                name: `${key} - ${HAZEL_PACKAGES[key as keyof typeof HAZEL_PACKAGES]}`,
                value: key,
              })),
            },
          ]);
          selectedPackage = pkg;
        }

        // Get the full package name
        const fullPackageName =
          HAZEL_PACKAGES[selectedPackage as keyof typeof HAZEL_PACKAGES];

        if (!fullPackageName) {
          console.log(chalk.yellow(`Unknown package: ${selectedPackage}`));
          console.log(chalk.gray('\nAvailable packages:'));
          Object.keys(HAZEL_PACKAGES).forEach((key) => {
            console.log(
              chalk.gray(`  - ${key}: ${HAZEL_PACKAGES[key as keyof typeof HAZEL_PACKAGES]}`)
            );
          });
          return;
        }

        console.log(
          chalk.blue(`\n📦 Installing ${fullPackageName}...`)
        );

        const devFlag = options?.dev ? '--save-dev' : '';
        const command = `npm install ${fullPackageName} ${devFlag}`.trim();

        execSync(command, { stdio: 'inherit' });

        console.log(chalk.green(`\n✓ Successfully installed ${fullPackageName}`));

        // Show usage hints
        console.log(chalk.gray('\nNext steps:'));
        switch (selectedPackage) {
          case 'ai':
            console.log(chalk.gray('  import { AIModule } from "@hazeljs/ai";'));
            break;
          case 'auth':
            console.log(chalk.gray('  import { AuthModule } from "@hazeljs/auth";'));
            break;
          case 'cache':
            console.log(chalk.gray('  import { CacheModule } from "@hazeljs/cache";'));
            break;
          case 'prisma':
            console.log(chalk.gray('  import { PrismaModule } from "@hazeljs/prisma";'));
            break;
          case 'swagger':
            console.log(chalk.gray('  import { SwaggerModule } from "@hazeljs/swagger";'));
            break;
          case 'websocket':
            console.log(chalk.gray('  import { WebSocketModule } from "@hazeljs/websocket";'));
            break;
        }
        console.log(
          chalk.gray(`\nDocumentation: https://hazeljs.com/docs/packages/${selectedPackage}`)
        );
      } catch (error) {
        console.error(chalk.red('Error installing package:'), error);
        process.exit(1);
      }
    });
}
