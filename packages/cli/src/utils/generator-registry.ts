import { GenerateResult, GenerateCLIOptions } from './generator';
import { runController } from '../commands/generate-controller';
import { runService } from '../commands/generate-service';
import { runModule } from '../commands/generate-module';
import { runDto } from '../commands/generate-dto';
import { runGuard } from '../commands/generate-guard';
import { runInterceptor } from '../commands/generate-interceptor';
import { runMiddleware } from '../commands/generate-middleware';
import { runCrud } from '../commands/generate-crud';
import { runAuth } from '../commands/generate-auth';
import { runWebSocketGateway } from '../commands/generate-websocket-gateway';
import { runExceptionFilter } from '../commands/generate-exception-filter';
import { runPipe } from '../commands/generate-pipe';
import { runRepository } from '../commands/generate-repository';
import { runAIService } from '../commands/generate-ai-service';
import { runAgent } from '../commands/generate-agent';
import { runServerlessHandler } from '../commands/generate-serverless-handler';
import { runConfig } from '../commands/generate-config';
import { runCache } from '../commands/generate-cache';
import { runCron } from '../commands/generate-cron';
import { runRag } from '../commands/generate-rag';
import { runDiscovery } from '../commands/generate-discovery';
import { runApp } from '../commands/generate-app';
import { runSetup } from '../commands/generate-setup';

export interface GeneratorMeta {
  type: string;
  description: string;
  nameRequired: boolean;
  options?: string[];
}

/** All available generator types and their metadata (for --list). */
export const GENERATOR_LIST: GeneratorMeta[] = [
  { type: 'app', description: 'Skeleton HazelJS application (minimal template)', nameRequired: true, options: ['path'] },
  { type: 'setup', description: 'Minimal setup starter file for a HazelJS package', nameRequired: true, options: ['path'] },
  { type: 'controller', description: 'REST controller', nameRequired: true },
  { type: 'service', description: 'Service class', nameRequired: true },
  { type: 'module', description: 'Module with controller, service, DTOs', nameRequired: true },
  { type: 'dto', description: 'Create and update DTOs', nameRequired: true },
  { type: 'guard', description: 'Guard (e.g. auth)', nameRequired: true },
  { type: 'interceptor', description: 'Interceptor', nameRequired: true },
  { type: 'middleware', description: 'Middleware', nameRequired: true },
  { type: 'crud', description: 'Full CRUD resource (controller, service, module, DTOs)', nameRequired: true, options: ['route'] },
  { type: 'auth', description: 'Auth module (JWT guard, service, controller, DTOs)', nameRequired: false },
  { type: 'gateway', description: 'WebSocket gateway', nameRequired: true },
  { type: 'filter', description: 'Exception filter', nameRequired: true },
  { type: 'pipe', description: 'Validation/transform pipe', nameRequired: true },
  { type: 'repository', description: 'Prisma repository', nameRequired: true },
  { type: 'ai-service', description: 'AI service with decorators', nameRequired: true },
  { type: 'agent', description: 'AI agent with @Agent and @Tool', nameRequired: true },
  { type: 'serverless', description: 'Serverless handler (Lambda or Cloud Function)', nameRequired: true, options: ['platform'] },
  { type: 'config', description: 'Config module setup', nameRequired: false },
  { type: 'cache', description: 'Cache service with decorators', nameRequired: true },
  { type: 'cron', description: 'Cron/scheduled job service', nameRequired: true },
  { type: 'rag', description: 'RAG (Retrieval-Augmented Generation) service', nameRequired: true },
  { type: 'discovery', description: 'Service discovery setup', nameRequired: true },
];

type Runner = (name: string, options: GenerateCLIOptions) => Promise<GenerateResult>;

const RUNNERS: Record<string, Runner> = {
  app: runApp,
  setup: runSetup,
  controller: runController,
  service: runService,
  module: runModule,
  dto: runDto,
  guard: runGuard,
  interceptor: runInterceptor,
  middleware: runMiddleware,
  crud: runCrud,
  auth: runAuth,
  gateway: runWebSocketGateway,
  filter: runExceptionFilter,
  pipe: runPipe,
  repository: runRepository,
  'ai-service': runAIService,
  agent: runAgent,
  serverless: runServerlessHandler,
  config: runConfig,
  cache: runCache,
  cron: runCron,
  rag: runRag,
  discovery: runDiscovery,
};

/**
 * Run a generator by type and name. Use for unified `hazel generate <type> <name>`.
 * For types that don't require a name (auth, config), pass a placeholder (e.g. 'auth').
 */
export async function runGenerator(
  type: string,
  name: string,
  options: GenerateCLIOptions
): Promise<GenerateResult> {
  const runner = RUNNERS[type];
  if (!runner) {
    return {
      ok: false,
      created: [],
      error: `Unknown generator type: "${type}". Use "hazel generate --list" to see available types.`,
    };
  }
  return runner(name, options);
}

export function getGeneratorTypes(): string[] {
  return GENERATOR_LIST.map((g) => g.type);
}
