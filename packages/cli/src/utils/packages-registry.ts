/**
 * Single source of truth for all HazelJS package metadata.
 * Used by: `hazel add`, `hazel new --interactive`, and `scaffoldPackageBoilerplate`.
 */

export interface HazelPackageMeta {
  /** Short name used in CLI (e.g. 'ai', 'auth') */
  shortName: string;
  /** Full npm package name */
  npm: string;
  /** Human-readable label for interactive prompts */
  label: string;
  /** Import hint shown after `hazel add` */
  hint: string;
  /** Module import statement for app.module.ts (null if library-only, no module) */
  moduleImport: string | null;
  /** The forRoot/config expression to use in imports array (null if no module) */
  moduleExpression: string | null;
  /** Minimal setup file content for `hazel add --setup` */
  setupTemplate: string | null;
}

export const HAZEL_PACKAGES: HazelPackageMeta[] = [
  {
    shortName: 'ai',
    npm: '@hazeljs/ai',
    label: 'AI Integration (@hazeljs/ai)',
    hint: 'import { AIModule } from "@hazeljs/ai";',
    moduleImport: "import { AIModule } from '@hazeljs/ai';",
    moduleExpression: 'AIModule',
    setupTemplate: null,
  },
  {
    shortName: 'agent',
    npm: '@hazeljs/agent',
    label: 'AI Agents (@hazeljs/agent)',
    hint: 'import { AgentModule } from "@hazeljs/agent";',
    moduleImport: "import { AgentModule } from '@hazeljs/agent';",
    moduleExpression: 'AgentModule',
    setupTemplate: null,
  },
  {
    shortName: 'audit',
    npm: '@hazeljs/audit',
    label: 'Audit Logging (@hazeljs/audit)',
    hint: 'import { AuditModule, ConsoleAuditTransport } from "@hazeljs/audit";\n  // AuditModule.forRoot({ transports: [new ConsoleAuditTransport()] })',
    moduleImport: "import { AuditModule, ConsoleAuditTransport } from '@hazeljs/audit';",
    moduleExpression: 'AuditModule.forRoot({ transports: [new ConsoleAuditTransport()] })',
    setupTemplate: `import { AuditModule, ConsoleAuditTransport } from '@hazeljs/audit';

// Add AuditModule.forRoot(...) to your HazelModule imports.
export const auditImports = [AuditModule.forRoot({ transports: [new ConsoleAuditTransport()] })];
`,
  },
  {
    shortName: 'auth',
    npm: '@hazeljs/auth',
    label: 'Authentication (@hazeljs/auth)',
    hint: 'import { JwtModule } from "@hazeljs/auth";\n  // JwtModule.forRoot({ secret: "your-secret", expiresIn: "1d" })',
    moduleImport: "import { JwtModule } from '@hazeljs/auth';",
    moduleExpression:
      "JwtModule.forRoot({ secret: process.env.JWT_SECRET || 'change-me', expiresIn: '1d' })",
    setupTemplate: null,
  },
  {
    shortName: 'oauth',
    npm: '@hazeljs/oauth',
    label: 'OAuth - Google/Microsoft/GitHub (@hazeljs/oauth)',
    hint: 'import { OAuthModule } from "@hazeljs/oauth";\n  // OAuthModule.forRoot({ providers: { google: {...}, microsoft: {...}, github: {...} } })',
    moduleImport: "import { OAuthModule } from '@hazeljs/oauth';",
    moduleExpression:
      'OAuthModule.forRoot({ providers: { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, redirectUri: process.env.OAUTH_REDIRECT_URI! } } })',
    setupTemplate: `import { OAuthModule } from '@hazeljs/oauth';

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
`,
  },
  {
    shortName: 'cache',
    npm: '@hazeljs/cache',
    label: 'Caching (@hazeljs/cache)',
    hint: 'import { CacheModule } from "@hazeljs/cache";',
    moduleImport: "import { CacheModule } from '@hazeljs/cache';",
    moduleExpression: 'CacheModule',
    setupTemplate: null,
  },
  {
    shortName: 'config',
    npm: '@hazeljs/config',
    label: 'Configuration (@hazeljs/config)',
    hint: 'import { ConfigModule } from "@hazeljs/config";\n  // ConfigModule.forRoot({ envFilePath: ".env" })',
    moduleImport: "import { ConfigModule } from '@hazeljs/config';",
    moduleExpression: "ConfigModule.forRoot({ envFilePath: '.env' })",
    setupTemplate: null,
  },
  {
    shortName: 'config-server',
    npm: '@hazeljs/config-server',
    label: 'Git config server (@hazeljs/config-server)',
    hint: 'import { ConfigServer } from "@hazeljs/config-server";\n  // await new ConfigServer({ git: { uri: process.env.CONFIG_GIT_URI! }, port: 8888 }).start()',
    moduleImport: "import { ConfigServerModule } from '@hazeljs/config-server';",
    moduleExpression:
      "ConfigServerModule.forRoot({ git: { uri: process.env.CONFIG_GIT_URI || '' }, port: 8888 })",
    setupTemplate: `import { ConfigServerModule } from '@hazeljs/config-server';

// Add ConfigServerModule.forRoot(...) to your HazelModule imports, then start:
// await new ConfigServer({ git: { uri: process.env.CONFIG_GIT_URI! }, port: 8888 }).start();
export const configServerImports = [
  ConfigServerModule.forRoot({ git: { uri: process.env.CONFIG_GIT_URI || '' }, port: 8888 }),
];
`,
  },
  {
    shortName: 'cron',
    npm: '@hazeljs/cron',
    label: 'Cron Jobs (@hazeljs/cron)',
    hint: 'import { CronModule } from "@hazeljs/cron";',
    moduleImport: "import { CronModule } from '@hazeljs/cron';",
    moduleExpression: 'CronModule',
    setupTemplate: null,
  },
  {
    shortName: 'data',
    npm: '@hazeljs/data',
    label: 'Data/ETL (@hazeljs/data)',
    hint: 'import { DataModule } from "@hazeljs/data";',
    moduleImport: "import { DataModule } from '@hazeljs/data';",
    moduleExpression: 'DataModule.forRoot()',
    setupTemplate: `import { DataModule } from '@hazeljs/data';

// Add DataModule.forRoot() to your HazelModule imports.
export const dataImports = [DataModule.forRoot()];
`,
  },
  {
    shortName: 'discovery',
    npm: '@hazeljs/discovery',
    label: 'Service Discovery (@hazeljs/discovery)',
    hint: 'import { ServiceRegistry, DiscoveryClient } from "@hazeljs/discovery";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: null,
  },
  {
    shortName: 'event-emitter',
    npm: '@hazeljs/event-emitter',
    label: 'Event Emitter (@hazeljs/event-emitter)',
    hint: 'import { EventEmitterModule } from "@hazeljs/event-emitter";',
    moduleImport: "import { EventEmitterModule } from '@hazeljs/event-emitter';",
    moduleExpression: 'EventEmitterModule.forRoot()',
    setupTemplate: `import { EventEmitterModule } from '@hazeljs/event-emitter';

// Add EventEmitterModule.forRoot() to your HazelModule imports.
export const eventEmitterImports = [EventEmitterModule.forRoot()];
`,
  },
  {
    shortName: 'gateway',
    npm: '@hazeljs/gateway',
    label: 'API Gateway (@hazeljs/gateway)',
    hint: 'import { GatewayModule } from "@hazeljs/gateway";',
    moduleImport: "import { GatewayModule } from '@hazeljs/gateway';",
    moduleExpression: 'GatewayModule',
    setupTemplate: `import { GatewayModule } from '@hazeljs/gateway';

// Add GatewayModule to your HazelModule imports.
export const gatewayImports = [GatewayModule];
`,
  },
  {
    shortName: 'guardrails',
    npm: '@hazeljs/guardrails',
    label: 'Guardrails (@hazeljs/guardrails)',
    hint: 'import { GuardrailsModule } from "@hazeljs/guardrails";\n  // GuardrailsModule.forRoot({ redactPIIByDefault: true })',
    moduleImport: "import { GuardrailsModule } from '@hazeljs/guardrails';",
    moduleExpression: 'GuardrailsModule.forRoot({ redactPIIByDefault: true })',
    setupTemplate: null,
  },
  {
    shortName: 'graphql',
    npm: '@hazeljs/graphql',
    label: 'GraphQL (@hazeljs/graphql)',
    hint: 'import { GraphQLModule } from "@hazeljs/graphql";',
    moduleImport: "import { GraphQLModule } from '@hazeljs/graphql';",
    moduleExpression: 'GraphQLModule',
    setupTemplate: `import { GraphQLModule } from '@hazeljs/graphql';

// Add GraphQLModule to your HazelModule imports.
export const graphqlImports = [GraphQLModule];
`,
  },
  {
    shortName: 'grpc',
    npm: '@hazeljs/grpc',
    label: 'gRPC (@hazeljs/grpc)',
    hint: 'import { GrpcModule } from "@hazeljs/grpc";',
    moduleImport: "import { GrpcModule } from '@hazeljs/grpc';",
    moduleExpression: 'GrpcModule',
    setupTemplate: `import { GrpcModule } from '@hazeljs/grpc';

// Add GrpcModule to your HazelModule imports. Define services in your module.
export const grpcImports = [GrpcModule];
`,
  },
  {
    shortName: 'kafka',
    npm: '@hazeljs/kafka',
    label: 'Kafka (@hazeljs/kafka)',
    hint: 'import { KafkaModule } from "@hazeljs/kafka";',
    moduleImport: "import { KafkaModule } from '@hazeljs/kafka';",
    moduleExpression: 'KafkaModule',
    setupTemplate: `import { KafkaModule } from '@hazeljs/kafka';

// Add KafkaModule to your HazelModule imports and configure brokers via env/config.
export const kafkaImports = [KafkaModule];
`,
  },
  {
    shortName: 'messaging',
    npm: '@hazeljs/messaging',
    label: 'Messaging - WhatsApp/Telegram (@hazeljs/messaging)',
    hint: 'import { MessagingModule } from "@hazeljs/messaging";',
    moduleImport: "import { MessagingModule } from '@hazeljs/messaging';",
    moduleExpression: 'MessagingModule',
    setupTemplate: `import { MessagingModule } from '@hazeljs/messaging';

// Add MessagingModule to your HazelModule imports. Configure channels (WhatsApp/Telegram) via env/config.
export const messagingImports = [MessagingModule];
`,
  },
  {
    shortName: 'ml',
    npm: '@hazeljs/ml',
    label: 'Machine Learning (@hazeljs/ml)',
    hint: 'import { MLModule } from "@hazeljs/ml";',
    moduleImport: "import { MLModule } from '@hazeljs/ml';",
    moduleExpression: 'MLModule.forRoot()',
    setupTemplate: `import { MLModule } from '@hazeljs/ml';

// Add MLModule.forRoot() to your HazelModule imports.
export const mlImports = [MLModule.forRoot()];
`,
  },
  {
    shortName: 'mcp',
    npm: '@hazeljs/mcp',
    label: 'MCP - Model Context Protocol (@hazeljs/mcp)',
    hint: 'import { createMcpServer } from "@hazeljs/mcp";\n  // createMcpServer({ name, version, toolRegistry }).listenStdio();',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { createMcpServer } from '@hazeljs/mcp';

// Minimal MCP server example:
const server = createMcpServer({ name: 'hazel-mcp', version: '0.1.0' });
server.start();
`,
  },
  {
    shortName: 'skillgate',
    npm: '@hazeljs/skillgate',
    label: 'Skillgate - OpenAPI → governed agent skills (@hazeljs/skillgate)',
    hint: 'import { Skillgate } from "@hazeljs/skillgate";\n  // Skillgate.fromOpenApi(spec).register(toolRegistry, "api-concierge");',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { Skillgate } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';

// Opt-in: tags agent|skillgate, x-hazel-skill, or explicit allowlists.
const gate = Skillgate.fromOpenApi(openApiSpec, {
  include: { tags: ['agent'] },
  invoke: { baseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:3000' },
});
const registry = new ToolRegistry();
    gate.register(registry, 'api-concierge');
`,
  },
  {
    shortName: 'agent-gatekeeper',
    npm: '@hazeljs/agent-gatekeeper',
    label: 'Agent Gatekeeper - tool authorization (@hazeljs/agent-gatekeeper)',
    hint: 'import { AgentGatekeeper } from "@hazeljs/agent-gatekeeper";\n  // new AgentGatekeeper({ mode: "enforce", defaultDecision: "deny", policies })',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';

export const gatekeeper = new AgentGatekeeper({
  mode: 'enforce',
  defaultDecision: 'deny',
  policies: [],
});
`,
  },
  {
    shortName: 'organism',
    npm: '@hazeljs/organism',
    label: 'Agentic Organism Runtime (@hazeljs/organism)',
    hint: 'import { createOrganism, OrganismRuntime } from "@hazeljs/organism";\n  // const organism = await createOrganism({ mission, genes, constitution })',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { createOrganism } from '@hazeljs/organism';

export async function startOrganism() {
  const organism = await createOrganism({
    mission: { id: 'ops', objective: 'Operate within budget and constraints' },
    genes: [],
    limits: { maxAgents: 10, maxGenerationDepth: 3 },
  });
  await organism.start();
  return organism;
}
`,
  },
  {
    shortName: 'pdf-to-audio',
    npm: '@hazeljs/pdf-to-audio',
    label: 'PDF to Audio (@hazeljs/pdf-to-audio)',
    hint: 'import { PdfToAudioModule } from "@hazeljs/pdf-to-audio";\n  // PdfToAudioModule converts PDFs to audio via TTS',
    moduleImport: "import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';",
    moduleExpression: 'PdfToAudioModule',
    setupTemplate: `import { PdfToAudioModule } from '@hazeljs/pdf-to-audio';

// Add PdfToAudioModule to your HazelModule imports.
export const pdfToAudioImports = [PdfToAudioModule];
`,
  },
  {
    shortName: 'prompts',
    npm: '@hazeljs/prompts',
    label: 'Prompts - typed templates (@hazeljs/prompts)',
    hint: 'import { PromptTemplate, PromptRegistry } from "@hazeljs/prompts";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { PromptTemplate } from '@hazeljs/prompts';

export const helloPrompt = new PromptTemplate({
  name: 'hello',
  template: 'Hello {{name}}',
});
`,
  },
  {
    shortName: 'prisma',
    npm: '@hazeljs/prisma',
    label: 'Prisma ORM (@hazeljs/prisma)',
    hint: 'import { PrismaModule } from "@hazeljs/prisma";',
    moduleImport: "import { PrismaModule } from '@hazeljs/prisma';",
    moduleExpression: 'PrismaModule',
    setupTemplate: `import { PrismaModule } from '@hazeljs/prisma';

// Add PrismaModule to your HazelModule imports.
export const prismaImports = [PrismaModule];
`,
  },
  {
    shortName: 'typeorm',
    npm: '@hazeljs/typeorm',
    label: 'TypeORM (@hazeljs/typeorm)',
    hint: 'import { TypeOrmModule } from "@hazeljs/typeorm";',
    moduleImport: "import { TypeOrmModule } from '@hazeljs/typeorm';",
    moduleExpression: 'TypeOrmModule',
    setupTemplate: `import { TypeOrmModule } from '@hazeljs/typeorm';

// Add TypeOrmModule to your HazelModule imports.
export const typeormImports = [TypeOrmModule];
`,
  },
  {
    shortName: 'queue',
    npm: '@hazeljs/queue',
    label: 'Queue/BullMQ (@hazeljs/queue)',
    hint: 'import { QueueModule } from "@hazeljs/queue";',
    moduleImport: "import { QueueModule } from '@hazeljs/queue';",
    moduleExpression: 'QueueModule',
    setupTemplate: `import { QueueModule } from '@hazeljs/queue';

// Add QueueModule to your HazelModule imports. Configure Redis / BullMQ via env/config.
export const queueImports = [QueueModule];
`,
  },
  {
    shortName: 'rag',
    npm: '@hazeljs/rag',
    label: 'RAG/Vector Search (@hazeljs/rag)',
    hint: 'import { RAGPipeline } from "@hazeljs/rag";',
    moduleImport: "import { RAGModule } from '@hazeljs/rag';",
    moduleExpression: 'RAGModule',
    setupTemplate: null,
  },
  {
    shortName: 'resilience',
    npm: '@hazeljs/resilience',
    label: 'Resilience - Circuit Breaker (@hazeljs/resilience)',
    hint: 'import { CircuitBreaker, WithRetry, WithTimeout } from "@hazeljs/resilience";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { CircuitBreaker, WithRetry } from '@hazeljs/resilience';

export class ExampleResilienceService {
  @WithRetry({ retries: 3 })
  @CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10000 })
  async callRemote(): Promise<string> {
    return 'ok';
  }
}
`,
  },
  {
    shortName: 'self-healing',
    npm: '@hazeljs/self-healing',
    label: 'Self-Healing Microservices (@hazeljs/self-healing)',
    hint: 'import { SelfHealing, SelfHeal, createHealingCoordinator } from "@hazeljs/self-healing";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { createHealingCoordinator } from '@hazeljs/self-healing';

export const healing = createHealingCoordinator({
  strategies: ['config-rollback', 'hpa-boost', 'pod-restart'],
});
`,
  },
  {
    shortName: 'predictive-scaling',
    npm: '@hazeljs/predictive-scaling',
    label: 'Predictive Auto-Scaling (@hazeljs/predictive-scaling)',
    hint: 'import { PredictiveScaling, createPredictiveScaler } from "@hazeljs/predictive-scaling";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: `import { createPredictiveScaler } from '@hazeljs/predictive-scaling';

// Wire hpa.client to your Kubernetes scaling client
export const scaler = createPredictiveScaler({
  horizon: '30m',
  metrics: ['requests', 'latency'],
  hpa: { name: 'api-hpa', client: scalingClient },
});
`,
  },
  {
    shortName: 'serverless',
    npm: '@hazeljs/serverless',
    label: 'Serverless (@hazeljs/serverless)',
    hint: 'import { createLambdaHandler } from "@hazeljs/serverless";',
    moduleImport: null,
    moduleExpression: null,
    setupTemplate: null,
  },
  {
    shortName: 'swagger',
    npm: '@hazeljs/swagger',
    label: 'Swagger/OpenAPI (@hazeljs/swagger)',
    hint: 'import { SwaggerModule } from "@hazeljs/swagger";',
    moduleImport: "import { SwaggerModule } from '@hazeljs/swagger';",
    moduleExpression: 'SwaggerModule',
    setupTemplate: `import { SwaggerModule } from '@hazeljs/swagger';
import { AppModule } from './app.module';

// Setup Swagger once before creating your app:
SwaggerModule.setRootModule(AppModule);
`,
  },
  {
    shortName: 'websocket',
    npm: '@hazeljs/websocket',
    label: 'WebSocket (@hazeljs/websocket)',
    hint: 'import { WebSocketModule } from "@hazeljs/websocket";',
    moduleImport: "import { WebSocketModule } from '@hazeljs/websocket';",
    moduleExpression: 'WebSocketModule',
    setupTemplate: null,
  },
];

/**
 * Look up a HazelJS package by its short CLI name or full npm package name.
 *
 * @param nameOrNpm - Either the short name ('ai', 'auth') or full npm name ('@hazeljs/ai')
 * @returns The matching package metadata, or undefined if not found
 */
export function findPackage(nameOrNpm: string): HazelPackageMeta | undefined {
  return HAZEL_PACKAGES.find((p) => p.shortName === nameOrNpm || p.npm === nameOrNpm);
}

/**
 * Map of short CLI name → HazelPackageMeta for O(1) lookups.
 *
 * Example: PACKAGES_BY_NAME['ai'] returns the @hazeljs/ai package metadata.
 */
export const PACKAGES_BY_NAME: Record<string, HazelPackageMeta> = Object.fromEntries(
  HAZEL_PACKAGES.map((p) => [p.shortName, p])
);
