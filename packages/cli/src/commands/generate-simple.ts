/**
 * Config-driven generator factory for simple single-file generators.
 * Replaces 12+ individual generator files with one data-driven approach.
 */
import { Command } from 'commander';
import { Generator, GenerateResult, GenerateCLIOptions, printGenerateResult } from '../utils/generator';

// ── Templates ────────────────────────────────────────────────────────────────

const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body, Param, Delete, Put } from '@hazeljs/core';
import { {{className}}Service } from './{{fileName}}.service';
import { Create{{className}}Dto } from './dto/create-{{fileName}}.dto';
import { Update{{className}}Dto } from './dto/update-{{fileName}}.dto';

@Controller('{{fileName}}')
export class {{className}}Controller {
  constructor(private readonly {{camelName}}Service: {{className}}Service) {}

  @Get()
  findAll() {
    return this.{{camelName}}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.{{camelName}}Service.findOne(id);
  }

  @Post()
  create(@Body(Create{{className}}Dto) createDto: Create{{className}}Dto) {
    return this.{{camelName}}Service.create(createDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(Update{{className}}Dto) updateDto: Update{{className}}Dto) {
    return this.{{camelName}}Service.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.{{camelName}}Service.remove(id);
  }
}
`;

const SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';

@Service()
export class {{className}}Service {
  constructor() {}

  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(createDto: any) {
    return createDto;
  }

  async update(id: string, updateDto: any) {
    return { id, ...updateDto };
  }

  async remove(id: string) {
    return { id };
  }
}
`;

const GUARD_TEMPLATE = `import { Injectable, type CanActivate, type ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Add your guard logic here
    return true;
  }
}
`;

const INTERCEPTOR_TEMPLATE = `import { Injectable, Interceptor, type ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Interceptor implements Interceptor {
  async intercept(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    // Pre-processing logic here (before handler execution)
    const result = await next();
    // Post-processing logic here (after handler execution)
    return result;
  }
}
`;

const MIDDLEWARE_TEMPLATE = `import { Injectable, type MiddlewareHandler, type Request, type Response, type NextFunction } from '@hazeljs/core';

@Injectable()
export class {{className}}Middleware implements MiddlewareHandler {
  use(req: Request, res: Response, next: NextFunction) {
    // Add your middleware logic here
    console.log(\`[{{className}}Middleware] \${req.method} \${req.url}\`);
    
    // Continue to next middleware
    next();
  }
}
`;

const PIPE_TEMPLATE = `import { type PipeTransform, type RequestContext } from '@hazeljs/core';

export class {{className}}Pipe implements PipeTransform {
  transform(value: unknown, context: RequestContext): unknown {
    // Transform logic here
    return value;
  }
}
`;

const EXCEPTION_FILTER_TEMPLATE = `import { Catch, type ExceptionFilter, type ArgumentsHost, HttpError, logger } from '@hazeljs/core';

@Catch(HttpError)
export class {{className}}ExceptionFilter implements ExceptionFilter<HttpError> {
  catch(exception: HttpError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.statusCode || 500;
    const message = exception.message || 'Internal server error';

    logger.error(\`[\${request.method}] \${request.url} - \${message} (\${status})\`);

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
`;

const REPOSITORY_TEMPLATE = `import { Repository, BaseRepository, PrismaService } from '@hazeljs/prisma';

// @Repository implies @Injectable() — no need for both decorators
@Repository({ model: '{{modelName}}' })
export class {{className}}Repository extends BaseRepository<any> {
  constructor(prisma: PrismaService) {
    super(prisma, '{{modelName}}');
  }

  // Add custom repository methods here
  async findByName(name: string) {
    return this.findMany({ where: { name } });
  }
}
`;

const WEBSOCKET_GATEWAY_TEMPLATE = `import { Realtime, OnConnect, OnDisconnect, OnMessage, Subscribe, Client, Data, WebSocketClient } from '@hazeljs/websocket';

@Realtime('/{{fileName}}')
export class {{className}}Gateway {
  @OnConnect()
  handleConnection(@Client() client: WebSocketClient) {
    console.log('Client connected:', client.id);
  }

  @OnDisconnect()
  handleDisconnect(@Client() client: WebSocketClient) {
    console.log('Client disconnected:', client.id);
  }

  @Subscribe('message')
  @OnMessage('message')
  handleMessage(@Client() client: WebSocketClient, @Data() data: unknown) {
    console.log('Message received from', client.id, ':', data);
    // Handle message logic here
  }
}
`;

const AI_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { AIService, AIFunction, AIPrompt } from '@hazeljs/ai';

@Service()
export class {{className}}AIService {
  constructor(private readonly aiService: AIService) {}

  @AIFunction({
    provider: 'openai',
    model: 'gpt-4',
    streaming: false,
  })
  async {{camelName}}Task(@AIPrompt() prompt: string): Promise<unknown> {
    const result = await this.aiService.complete({
      provider: 'openai',
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return result;
  }
}
`;

const AGENT_TEMPLATE = `import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: '{{fileName}}',
  description: '{{description}}',
  systemPrompt: 'You are a helpful {{className}} agent.',
  enableMemory: true,
  enableRAG: true,
})
export class {{className}}Agent {
  @Tool({
    description: 'Example tool for {{fileName}}',
    parameters: [
      {
        name: 'input',
        type: 'string',
        description: 'Input parameter',
        required: true,
      },
    ],
  })
  async exampleTool(input: { input: string }): Promise<{ result: string }> {
    // Implement your tool logic here
    return {
      result: \`Processed: \${input.input}\`,
    };
  }
}
`;

const CACHE_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { CacheService, Cacheable, CacheEvict } from '@hazeljs/cache';

@Service()
export class {{className}}CacheService {
  constructor(private readonly cacheService: CacheService) {}

  @Cacheable({ key: '{{fileName}}:all', ttl: 60 })
  async findAll() {
    // This result will be cached for 60 seconds
    return [];
  }

  @Cacheable({ key: '{{fileName}}:{{=<% %>=}}#{id}<%={{ }}=%>', ttl: 300 })
  async findOne(id: string) {
    // This result will be cached for 5 minutes
    return { id };
  }

  @CacheEvict({ key: '{{fileName}}:all' })
  async create(data: any) {
    // Creating a new item evicts the list cache
    return data;
  }

  async clearAll() {
    await this.cacheService.clear();
  }
}
`;

const CRON_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { Cron, CronExpression } from '@hazeljs/cron';

@Service()
export class {{className}}CronService {
  @Cron(CronExpression.EVERY_MINUTE)
  handleEveryMinute() {
    console.log('[{{className}}Cron] Running every minute...');
    // Add your cron job logic here
  }

  @Cron('0 0 * * *')  // Every day at midnight
  handleDaily() {
    console.log('[{{className}}Cron] Running daily task...');
    // Add your daily task logic here
  }

  @Cron(CronExpression.EVERY_HOUR)
  handleHourly() {
    console.log('[{{className}}Cron] Running hourly cleanup...');
    // Add your hourly task logic here
  }
}
`;

const RAG_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { RAGPipeline, MemoryVectorStore } from '@hazeljs/rag';

@Service()
export class {{className}}RagService {
  private pipeline: RAGPipeline;

  constructor() {
    // Initialize with a memory vector store (swap for Pinecone, Qdrant, etc. in production)
    const vectorStore = new MemoryVectorStore();

    this.pipeline = new RAGPipeline({
      vectorStore,
      topK: 5,
    });
  }

  async addDocument(content: string, metadata?: Record<string, unknown>) {
    // Add a document to the vector store for retrieval
    await this.pipeline.addDocument({
      content,
      metadata: metadata || {},
    });
  }

  async query(question: string) {
    // Retrieve relevant documents and generate a response
    const results = await this.pipeline.query(question);
    return results;
  }
}
`;

const DISCOVERY_TEMPLATE = `import { Service } from '@hazeljs/core';
import { ServiceRegistry, DiscoveryClient } from '@hazeljs/discovery';

@Service()
export class {{className}}DiscoveryService {
  constructor(
    private readonly registry: ServiceRegistry,
    private readonly client: DiscoveryClient,
  ) {}

  async registerService() {
    await this.registry.register({
      name: '{{fileName}}-service',
      host: 'localhost',
      port: 3000,
      metadata: {
        version: '1.0.0',
      },
    });
  }

  async discoverService(serviceName: string) {
    const instances = await this.client.getInstances(serviceName);
    return instances;
  }
}
`;

const CONFIG_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
import { ConfigModule, ConfigService } from '@hazeljs/config';

// Import ConfigModule.forRoot() in your app module:
//
// @HazelModule({
//   imports: [
//     ConfigModule.forRoot({
//       envFilePath: '.env',
//     }),
//   ],
// })
//
// Then inject ConfigService wherever you need it:
//
// constructor(private readonly config: ConfigService) {}
//
// Usage:
//   this.config.get('DATABASE_URL');
//   this.config.get('PORT', '3000');  // with default value

export { ConfigModule, ConfigService };
`;

const SERVERLESS_LAMBDA_TEMPLATE = `import { createLambdaHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createLambdaHandler(AppModule);
`;

const SERVERLESS_CLOUD_FUNCTION_TEMPLATE = `import { createCloudFunctionHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createCloudFunctionHandler(AppModule);
`;

// ── Generator config ─────────────────────────────────────────────────────────

export interface SimpleGeneratorConfig {
  type: string;
  description: string;
  suffix: string;
  template: string;
  alias?: string;
  defaultPath?: string;
  nameRequired: boolean;
  /** Extra template data injected at generation time */
  extraData?: (name: string) => Record<string, string>;
  /** Next steps shown after generation */
  nextSteps?: string[];
  /** Extra CLI options beyond --path, --dry-run, --json */
  extraOptions?: string[];
}

export const SIMPLE_GENERATORS: SimpleGeneratorConfig[] = [
  { type: 'controller', description: 'REST controller', suffix: 'controller', template: CONTROLLER_TEMPLATE, alias: 'c', nameRequired: true },
  { type: 'service', description: 'Service class', suffix: 'service', template: SERVICE_TEMPLATE, alias: 's', nameRequired: true },
  { type: 'guard', description: 'Guard (e.g. auth)', suffix: 'guard', template: GUARD_TEMPLATE, alias: 'gu', nameRequired: true },
  { type: 'interceptor', description: 'Interceptor', suffix: 'interceptor', template: INTERCEPTOR_TEMPLATE, alias: 'i', nameRequired: true },
  { type: 'middleware', description: 'Middleware', suffix: 'middleware', template: MIDDLEWARE_TEMPLATE, alias: 'mw', defaultPath: 'src/middleware', nameRequired: true, nextSteps: ['Import the middleware in your module or apply it globally.'] },
  { type: 'pipe', description: 'Validation/transform pipe', suffix: 'pipe', template: PIPE_TEMPLATE, nameRequired: true },
  { type: 'filter', description: 'Exception filter', suffix: 'filter', template: EXCEPTION_FILTER_TEMPLATE, alias: 'f', nameRequired: true },
  { type: 'repository', description: 'Prisma repository', suffix: 'repository', template: REPOSITORY_TEMPLATE, alias: 'repo', nameRequired: true },
  { type: 'gateway', description: 'WebSocket gateway', suffix: 'gateway', template: WEBSOCKET_GATEWAY_TEMPLATE, alias: 'ws', nameRequired: true },
  { type: 'ai-service', description: 'AI service with decorators', suffix: 'ai-service', template: AI_SERVICE_TEMPLATE, alias: 'ai', nameRequired: true },
  { type: 'agent', description: 'AI agent with @Agent and @Tool', suffix: 'agent', template: AGENT_TEMPLATE, nameRequired: true, extraData: (name) => ({ description: `A ${name} agent` }) },
  { type: 'cache', description: 'Cache service with decorators', suffix: 'cache', template: CACHE_SERVICE_TEMPLATE, nameRequired: true, nextSteps: ['npm install @hazeljs/cache', 'Add CacheModule to your module imports', 'Configure the cache strategy (memory, redis, or multi-tier)'] },
  { type: 'cron', description: 'Cron/scheduled job service', suffix: 'cron', template: CRON_SERVICE_TEMPLATE, alias: 'job', nameRequired: true, nextSteps: ['npm install @hazeljs/cron', 'Add CronModule to your module imports', 'Register this service as a provider'] },
  { type: 'rag', description: 'RAG (Retrieval-Augmented Generation) service', suffix: 'rag', template: RAG_SERVICE_TEMPLATE, nameRequired: true, nextSteps: ['npm install @hazeljs/rag', 'Register this service as a provider in your module', 'Configure your embedding provider and vector store'] },
  { type: 'discovery', description: 'Service discovery setup', suffix: 'discovery', template: DISCOVERY_TEMPLATE, nameRequired: true, nextSteps: ['npm install @hazeljs/discovery', 'Register this service as a provider in your module', 'Configure your discovery backend (memory, redis, consul, or kubernetes)'] },
  { type: 'config', description: 'Config module setup', suffix: 'config', template: CONFIG_TEMPLATE, nameRequired: false, nextSteps: ['npm install @hazeljs/config', 'Add ConfigModule.forRoot({ envFilePath: ".env" }) to your app module imports', 'Create a .env file in your project root'] },
  { type: 'serverless', description: 'Serverless handler (Lambda or Cloud Function)', suffix: 'handler', template: SERVERLESS_LAMBDA_TEMPLATE, alias: 'sls', nameRequired: true, extraOptions: ['platform'] },
];

// ── Runner factory ───────────────────────────────────────────────────────────

class SimpleGenerator extends Generator {
  constructor(private readonly _suffix: string, private readonly _template: string) {
    super();
    this.suffix = _suffix;
  }

  protected getDefaultTemplate(): string {
    return this._template;
  }
}

export async function runSimpleGenerator(
  config: SimpleGeneratorConfig,
  name: string,
  options: GenerateCLIOptions
): Promise<GenerateResult> {
  // Handle serverless platform option
  let template = config.template;
  if (config.type === 'serverless' && options.platform === 'cloud-function') {
    template = SERVERLESS_CLOUD_FUNCTION_TEMPLATE;
  }

  const generator = new SimpleGenerator(config.suffix, template);
  const effectiveName = config.nameRequired ? name : (name || 'app');
  const result = await generator.generate({
    name: effectiveName,
    path: options.path || config.defaultPath,
    dryRun: options.dryRun,
    data: config.extraData ? config.extraData(effectiveName) : undefined,
  });

  if (config.nextSteps) {
    result.nextSteps = [...(result.nextSteps ?? []), ...config.nextSteps];
  }

  return result;
}

/** Register all simple generators as sub-commands of the generate command */
export function registerSimpleGenerators(generateCommand: Command): void {
  for (const config of SIMPLE_GENERATORS) {
    const cmdStr = config.nameRequired ? `${config.type} <name>` : config.type;
    const cmd = generateCommand.command(cmdStr).description(config.description);

    if (config.alias) cmd.alias(config.alias);

    cmd.option('-p, --path <path>', 'Path where the file should be generated', config.defaultPath);
    cmd.option('--dry-run', 'Preview files without writing them');
    cmd.option('--json', 'Output result as JSON');

    if (config.extraOptions?.includes('platform')) {
      cmd.option('--platform <platform>', 'Platform: lambda or cloud-function', 'lambda');
    }

    cmd.action(async (nameOrOptions: string | GenerateCLIOptions, maybeOptions?: GenerateCLIOptions) => {
      const name = typeof nameOrOptions === 'string' ? nameOrOptions : '';
      const opts = typeof nameOrOptions === 'string' ? (maybeOptions || {}) : nameOrOptions;
      const result = await runSimpleGenerator(config, name, opts as GenerateCLIOptions);
      printGenerateResult(result, { json: (opts as GenerateCLIOptions).json });
    });
  }
}

/** Lookup a simple generator config by type */
export function findSimpleGenerator(type: string): SimpleGeneratorConfig | undefined {
  return SIMPLE_GENERATORS.find((g) => g.type === type);
}
