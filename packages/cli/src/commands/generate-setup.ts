import { Command } from 'commander';
import { Generator, GenerateCLIOptions, GenerateResult, printGenerateResult } from '../utils/generator';

function packageToNpmName(input: string): string {
  if (input.startsWith('@hazeljs/')) return input;
  return `@hazeljs/${input}`;
}

function packageToTemplate(pkg: string): string {
  const npmName = packageToNpmName(pkg);
  const short = npmName.replace('@hazeljs/', '');

  // Keep these templates intentionally minimal: a real import + a tiny “hello usage”
  // so users can immediately search/expand, without forcing a specific app structure.
  switch (short) {
    case 'swagger':
      return `import { SwaggerModule } from '@hazeljs/swagger';
import { AppModule } from './app.module';

// Setup Swagger once before creating your app:
SwaggerModule.setRootModule(AppModule);
`;
    case 'prisma':
      return `import { PrismaModule } from '@hazeljs/prisma';

// Add PrismaModule to your HazelModule imports.
export const prismaImports = [PrismaModule];
`;
    case 'typeorm':
      return `import { TypeOrmModule } from '@hazeljs/typeorm';

// Add TypeOrmModule to your HazelModule imports.
export const typeormImports = [TypeOrmModule];
`;
    case 'oauth':
      return `import { OAuthModule } from '@hazeljs/oauth';

// Example (Google). Put secrets in env vars:
// GOOGLE_CLIENT_ID=...
// GOOGLE_CLIENT_SECRET=...
// OAUTH_REDIRECT_URI=...
export const oauthImports = [
  OAuthModule.forRoot({
    providers: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.OAUTH_REDIRECT_URI!,
      },
    },
  }),
];
`;
    case 'kafka':
      return `import { KafkaModule } from '@hazeljs/kafka';

// Add KafkaModule to your HazelModule imports and configure brokers via env/config.
export const kafkaImports = [KafkaModule];
`;
    case 'grpc':
      return `import { GrpcModule } from '@hazeljs/grpc';

// Add GrpcModule to your HazelModule imports. Define services in your module.
export const grpcImports = [GrpcModule];
`;
    case 'graphql':
      return `import { GraphQLModule } from '@hazeljs/graphql';

// Add GraphQLModule to your HazelModule imports.
export const graphqlImports = [GraphQLModule];
`;
    case 'gateway':
      return `import { GatewayModule } from '@hazeljs/gateway';

// Add GatewayModule to your HazelModule imports.
export const gatewayImports = [GatewayModule];
`;
    case 'event-emitter':
      return `import { EventEmitterModule } from '@hazeljs/event-emitter';

// Add EventEmitterModule.forRoot() to your HazelModule imports.
export const eventEmitterImports = [EventEmitterModule.forRoot()];
`;
    case 'audit':
      return `import { AuditModule, ConsoleAuditTransport } from '@hazeljs/audit';

// Add AuditModule.forRoot(...) to your HazelModule imports.
export const auditImports = [AuditModule.forRoot({ transports: [new ConsoleAuditTransport()] })];
`;
    case 'queue':
      return `import { QueueModule } from '@hazeljs/queue';

// Add QueueModule to your HazelModule imports. Configure Redis / BullMQ via env/config.
export const queueImports = [QueueModule];
`;
    case 'messaging':
      return `import { MessagingModule } from '@hazeljs/messaging';

// Add MessagingModule to your HazelModule imports. Configure channels (WhatsApp/Telegram) via env/config.
export const messagingImports = [MessagingModule];
`;
    case 'mcp':
      return `import { createMcpServer } from '@hazeljs/mcp';

// Minimal MCP server example:
const server = createMcpServer({ name: 'hazel-mcp', version: '0.1.0' });
server.start();
`;
    case 'prompts':
      return `import { PromptTemplate } from '@hazeljs/prompts';

export const helloPrompt = new PromptTemplate({
  name: 'hello',
  template: 'Hello {{name}}',
});
`;
    case 'data':
      return `import { DataModule } from '@hazeljs/data';

// Add DataModule.forRoot() to your HazelModule imports.
export const dataImports = [DataModule.forRoot()];
`;
    case 'ml':
      return `import { MLModule } from '@hazeljs/ml';

// Add MLModule.forRoot() to your HazelModule imports.
export const mlImports = [MLModule.forRoot()];
`;
    case 'resilience':
      return `import { CircuitBreaker, WithRetry } from '@hazeljs/resilience';

export class ExampleResilienceService {
  @WithRetry({ retries: 3 })
  @CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10000 })
  async callRemote(): Promise<string> {
    return 'ok';
  }
}
`;
    case 'pdf-to-audio':
      return `import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';

// Add PdfToAudioModule to your HazelModule imports.
export const pdfToAudioImports = [PdfToAudioModule];
`;
    default:
      return `import '${npmName}';

// Starter file generated for ${npmName}.
// Tip: check the package README for setup details and examples.
`;
  }
}

class SetupGenerator extends Generator {
  protected suffix = 'setup';
}

export async function runSetup(pkg: string, options: GenerateCLIOptions): Promise<GenerateResult> {
  const npmName = packageToNpmName(pkg);
  const template = packageToTemplate(pkg);
  const generator = new SetupGenerator();
  const result = await generator.generate({
    name: pkg,
    path: options.path,
    template,
    dryRun: options.dryRun,
  });
  result.nextSteps = result.nextSteps ?? [];
  result.nextSteps.push(`npm install ${npmName}`);
  return result;
}

export function generateSetup(program: Command): void {
  program
    .command('setup <package>')
    .description('Generate a minimal setup starter file for a HazelJS package')
    .alias('st')
    .option('-p, --path <path>', 'Path where the setup file should be generated', 'src')
    .option('--dry-run', 'Preview files without writing them')
    .option('--json', 'Output result as JSON')
    .action(async (pkg: string, options: GenerateCLIOptions) => {
      const result = await runSetup(pkg, options);
      printGenerateResult(result, { json: options.json });
    });
}

