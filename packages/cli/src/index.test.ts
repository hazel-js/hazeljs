import { Command } from 'commander';
import { generateController } from './commands/generate-controller';
import { generateService } from './commands/generate-service';
import { generateModule } from './commands/generate-module';
import { generateDto } from './commands/generate-dto';
import { generateGuard } from './commands/generate-guard';
import { generateInterceptor } from './commands/generate-interceptor';
import { generateMiddleware } from './commands/generate-middleware';
import { generateCrud } from './commands/generate-crud';
import { generateAuth } from './commands/generate-auth';
import { generateWebSocketGateway } from './commands/generate-websocket-gateway';
import { generateExceptionFilter } from './commands/generate-exception-filter';
import { generatePipe } from './commands/generate-pipe';
import { generateRepository } from './commands/generate-repository';
import { generateAIService } from './commands/generate-ai-service';
import { generateAgent } from './commands/generate-agent';
import { generateServerlessHandler } from './commands/generate-serverless-handler';
import { generateConfig } from './commands/generate-config';
import { generateCache } from './commands/generate-cache';
import { generateCron } from './commands/generate-cron';
import { generateRag } from './commands/generate-rag';
import { generateDiscovery } from './commands/generate-discovery';

jest.mock('./commands/generate-controller');
jest.mock('./commands/generate-service');
jest.mock('./commands/generate-module');
jest.mock('./commands/generate-dto');
jest.mock('./commands/generate-guard');
jest.mock('./commands/generate-interceptor');
jest.mock('./commands/generate-middleware');
jest.mock('./commands/generate-crud');
jest.mock('./commands/generate-auth');
jest.mock('./commands/generate-websocket-gateway');
jest.mock('./commands/generate-exception-filter');
jest.mock('./commands/generate-pipe');
jest.mock('./commands/generate-repository');
jest.mock('./commands/generate-ai-service');
jest.mock('./commands/generate-agent');
jest.mock('./commands/generate-serverless-handler');
jest.mock('./commands/generate-config');
jest.mock('./commands/generate-cache');
jest.mock('./commands/generate-cron');
jest.mock('./commands/generate-rag');
jest.mock('./commands/generate-discovery');

let exitSpy: jest.SpyInstance;

beforeAll(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});
afterAll(() => {
  exitSpy.mockRestore();
});

describe('CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register all generator commands', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');

    // Core generators
    expect(generateController).toHaveBeenCalled();
    expect(generateService).toHaveBeenCalled();
    expect(generateModule).toHaveBeenCalled();
    expect(generateDto).toHaveBeenCalled();
    expect(generateGuard).toHaveBeenCalled();
    expect(generateInterceptor).toHaveBeenCalled();
    expect(generateMiddleware).toHaveBeenCalled();

    // Advanced generators
    expect(generateCrud).toHaveBeenCalled();
    expect(generateAuth).toHaveBeenCalled();
    expect(generateWebSocketGateway).toHaveBeenCalled();
    expect(generateExceptionFilter).toHaveBeenCalled();
    expect(generatePipe).toHaveBeenCalled();
    expect(generateRepository).toHaveBeenCalled();
    expect(generateAIService).toHaveBeenCalled();
    expect(generateAgent).toHaveBeenCalled();
    expect(generateServerlessHandler).toHaveBeenCalled();
    expect(generateConfig).toHaveBeenCalled();
    expect(generateCache).toHaveBeenCalled();
    expect(generateCron).toHaveBeenCalled();
    expect(generateRag).toHaveBeenCalled();
    expect(generateDiscovery).toHaveBeenCalled();
  });

  it('should have generate command with alias g', () => {
    const program = new Command();
    program.name('hazel').description('CLI for generating HazelJS components').version('0.2.0');
    const generate = program.command('generate').description('Generate a new component').alias('g');
    generateController(generate);
    generateService(generate);
    generateModule(generate);
    expect(generate.alias()).toBe('g');
  });
});
