/**
 * Mustache templates for all simple (single-file) generators.
 *
 * Each template uses three standard variables provided by the Generator base class:
 *   - {{className}}  — PascalCase name (e.g. "Users")
 *   - {{fileName}}   — kebab-case name (e.g. "users")
 *   - {{camelName}}  — camelCase name (e.g. "users")
 *
 * Some templates accept additional data via `extraData` in SimpleGeneratorConfig:
 *   - AGENT_TEMPLATE       — {{description}}
 *   - REPOSITORY_TEMPLATE  — {{modelName}} (defaults to fileName)
 *
 * Templates are imported by generate-simple.ts and referenced in the
 * SIMPLE_GENERATORS config array. To add a new generator, create a template
 * here and add a config entry in generate-simple.ts.
 */

// ── Core framework generators ────────────────────────────────────────────────

export const CONTROLLER_TEMPLATE = `import { Controller, Get, Post, Body, Param, Delete, Put } from '@hazeljs/core';
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

export const SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';

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

export const GUARD_TEMPLATE = `import { Injectable, type CanActivate, type ExecutionContext } from '@hazeljs/core';

@Injectable()
export class {{className}}Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    // Add your guard logic here
    return true;
  }
}
`;

export const INTERCEPTOR_TEMPLATE = `import { Injectable, Interceptor, type ExecutionContext } from '@hazeljs/core';

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

export const MIDDLEWARE_TEMPLATE = `import { Injectable, type MiddlewareHandler, type Request, type Response, type NextFunction } from '@hazeljs/core';

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

export const PIPE_TEMPLATE = `import { type PipeTransform, type RequestContext } from '@hazeljs/core';

export class {{className}}Pipe implements PipeTransform {
  transform(value: unknown, context: RequestContext): unknown {
    // Transform logic here
    return value;
  }
}
`;

export const EXCEPTION_FILTER_TEMPLATE = `import { Catch, type ExceptionFilter, type ArgumentsHost, HttpError, logger } from '@hazeljs/core';

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

// ── Package-specific generators ──────────────────────────────────────────────

export const REPOSITORY_TEMPLATE = `import { Repository, BaseRepository, PrismaService } from '@hazeljs/prisma';

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

export const WEBSOCKET_GATEWAY_TEMPLATE = `import { Realtime, OnConnect, OnDisconnect, OnMessage, Subscribe, Client, Data, WebSocketClient } from '@hazeljs/websocket';

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

export const AI_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
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

export const AGENT_TEMPLATE = `import { Agent, Tool } from '@hazeljs/agent';

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

export const CACHE_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
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

export const CRON_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
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

export const RAG_SERVICE_TEMPLATE = `import { Service } from '@hazeljs/core';
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

export const RAG_PIPELINE_TEMPLATE = `import { Service } from '@hazeljs/core';
import { RAGPipeline } from '@hazeljs/rag';

/**
 * RAG pipeline scaffold — uses {@link RAGPipeline.from} with in-memory vectors.
 * Swap persistence via HazelAI \`persistence.rag\` or construct {@link RAGPipeline} with Pinecone/Qdrant/Weaviate/Chroma.
 */
@Service()
export class {{className}}RagPipelineService {
  private pipeline: RAGPipeline | null = null;

  async ensurePipeline(): Promise<RAGPipeline> {
    if (this.pipeline) return this.pipeline;
    this.pipeline = RAGPipeline.from({
      provider: 'openai',
      vectorStore: 'memory',
      topK: 5,
      chunkSize: 1000,
      chunkOverlap: 200,
      llm: async (prompt: string) => {
        // Wire to your LLM (HazelAI, AIService, or HTTP)
        return prompt;
      },
    });
    await this.pipeline.initialize();
    return this.pipeline;
  }

  async query(question: string) {
    const p = await this.ensurePipeline();
    return p.query(question);
  }
}
`;

export const DISCOVERY_TEMPLATE = `import { Service } from '@hazeljs/core';
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

export const CONFIG_TEMPLATE = `import { HazelModule } from '@hazeljs/core';
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

// ── Serverless generators ────────────────────────────────────────────────────

export const SERVERLESS_LAMBDA_TEMPLATE = `import { createLambdaHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createLambdaHandler(AppModule);
`;

export const SERVERLESS_CLOUD_FUNCTION_TEMPLATE = `import { createCloudFunctionHandler } from '@hazeljs/serverless';
import { AppModule } from './app.module';

export const handler = createCloudFunctionHandler(AppModule);
`;
