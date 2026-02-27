import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

const HAZEL_PACKAGES: Record<string, { npm: string; hint: string }> = {
  ai: {
    npm: '@hazeljs/ai',
    hint: 'import { AIModule } from "@hazeljs/ai";',
  },
  agent: {
    npm: '@hazeljs/agent',
    hint: 'import { AgentModule } from "@hazeljs/agent";',
  },
  auth: {
    npm: '@hazeljs/auth',
    hint: 'import { JwtModule } from "@hazeljs/auth";\n  // JwtModule.forRoot({ secret: "your-secret", expiresIn: "1d" })',
  },
  cache: {
    npm: '@hazeljs/cache',
    hint: 'import { CacheModule } from "@hazeljs/cache";',
  },
  config: {
    npm: '@hazeljs/config',
    hint: 'import { ConfigModule } from "@hazeljs/config";\n  // ConfigModule.forRoot({ envFilePath: ".env" })',
  },
  cron: {
    npm: '@hazeljs/cron',
    hint: 'import { CronModule } from "@hazeljs/cron";',
  },
  data: {
    npm: '@hazeljs/data',
    hint: 'import { DataModule } from "@hazeljs/data";',
  },
  discovery: {
    npm: '@hazeljs/discovery',
    hint: 'import { ServiceRegistry, DiscoveryClient } from "@hazeljs/discovery";',
  },
  'event-emitter': {
    npm: '@hazeljs/event-emitter',
    hint: 'import { EventEmitterModule } from "@hazeljs/event-emitter";',
  },
  gateway: {
    npm: '@hazeljs/gateway',
    hint: 'import { GatewayModule } from "@hazeljs/gateway";',
  },
  graphql: {
    npm: '@hazeljs/graphql',
    hint: 'import { GraphQLModule } from "@hazeljs/graphql";',
  },
  grpc: {
    npm: '@hazeljs/grpc',
    hint: 'import { GrpcModule } from "@hazeljs/grpc";',
  },
  kafka: {
    npm: '@hazeljs/kafka',
    hint: 'import { KafkaModule } from "@hazeljs/kafka";',
  },
  messaging: {
    npm: '@hazeljs/messaging',
    hint: 'import { MessagingModule } from "@hazeljs/messaging";',
  },
  ml: {
    npm: '@hazeljs/ml',
    hint: 'import { MLModule } from "@hazeljs/ml";',
  },
  prisma: {
    npm: '@hazeljs/prisma',
    hint: 'import { PrismaModule } from "@hazeljs/prisma";',
  },
  queue: {
    npm: '@hazeljs/queue',
    hint: 'import { QueueModule } from "@hazeljs/queue";',
  },
  rag: {
    npm: '@hazeljs/rag',
    hint: 'import { RAGPipeline } from "@hazeljs/rag";',
  },
  resilience: {
    npm: '@hazeljs/resilience',
    hint: 'import { CircuitBreaker, WithRetry, WithTimeout } from "@hazeljs/resilience";',
  },
  'pdf-to-audio': {
    npm: '@hazeljs/pdf-to-audio',
    hint: 'import { PdfToAudioModule } from "@hazeljs/pdf-to-audio";\n  // PdfToAudioModule converts PDFs to audio via TTS',
  },
  serverless: {
    npm: '@hazeljs/serverless',
    hint: 'import { createLambdaHandler } from "@hazeljs/serverless";',
  },
  swagger: {
    npm: '@hazeljs/swagger',
    hint: 'import { SwaggerModule } from "@hazeljs/swagger";',
  },
  websocket: {
    npm: '@hazeljs/websocket',
    hint: 'import { WebSocketModule } from "@hazeljs/websocket";',
  },
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
                name: `${key} - ${HAZEL_PACKAGES[key].npm}`,
                value: key,
              })),
            },
          ]);
          selectedPackage = pkg;
        }

        // Get the package info
        const pkgInfo = HAZEL_PACKAGES[selectedPackage as string];

        if (!pkgInfo) {
          console.log(chalk.yellow(`Unknown package: ${selectedPackage}`));
          console.log(chalk.gray('\nAvailable packages:'));
          Object.keys(HAZEL_PACKAGES).forEach((key) => {
            console.log(chalk.gray(`  - ${key}: ${HAZEL_PACKAGES[key].npm}`));
          });
          return;
        }

        console.log(chalk.blue(`\n\uD83D\uDCE6 Installing ${pkgInfo.npm}...`));

        const devFlag = options?.dev ? '--save-dev' : '';
        const command = `npm install ${pkgInfo.npm} ${devFlag}`.trim();

        execSync(command, { stdio: 'inherit' });

        console.log(chalk.green(`\n\u2713 Successfully installed ${pkgInfo.npm}`));

        // Show usage hints
        console.log(chalk.gray('\nUsage:'));
        console.log(chalk.gray(`  ${pkgInfo.hint}`));
        console.log(
          chalk.gray(`\nDocumentation: https://hazeljs.com/docs/packages/${selectedPackage}`)
        );
      } catch (error) {
        console.error(chalk.red('Error installing package:'), error);
        process.exit(1);
      }
    });
}
