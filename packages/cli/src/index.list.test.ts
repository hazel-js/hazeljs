// Mock generators so requiring ./index doesn't do real work
jest.mock('./commands/generate-app', () => ({
  generateApp: jest.fn(),
  registerGenerateApp: jest.fn(),
}));
jest.mock('./commands/generate-controller', () => ({ generateController: jest.fn() }));
jest.mock('./commands/generate-service', () => ({ generateService: jest.fn() }));
jest.mock('./commands/generate-module', () => ({ generateModule: jest.fn() }));
jest.mock('./commands/generate-dto', () => ({ generateDto: jest.fn() }));
jest.mock('./commands/generate-guard', () => ({ generateGuard: jest.fn() }));
jest.mock('./commands/generate-interceptor', () => ({ generateInterceptor: jest.fn() }));
jest.mock('./commands/generate-middleware', () => ({ generateMiddleware: jest.fn() }));
jest.mock('./commands/generate-crud', () => ({ generateCrud: jest.fn() }));
jest.mock('./commands/generate-auth', () => ({ generateAuth: jest.fn() }));
jest.mock('./commands/generate-websocket-gateway', () => ({ generateWebSocketGateway: jest.fn() }));
jest.mock('./commands/generate-exception-filter', () => ({ generateExceptionFilter: jest.fn() }));
jest.mock('./commands/generate-pipe', () => ({ generatePipe: jest.fn() }));
jest.mock('./commands/generate-repository', () => ({ generateRepository: jest.fn() }));
jest.mock('./commands/generate-ai-service', () => ({ generateAIService: jest.fn() }));
jest.mock('./commands/generate-agent', () => ({ generateAgent: jest.fn() }));
jest.mock('./commands/generate-serverless-handler', () => ({ generateServerlessHandler: jest.fn() }));
jest.mock('./commands/generate-config', () => ({ generateConfig: jest.fn() }));
jest.mock('./commands/generate-cache', () => ({ generateCache: jest.fn() }));
jest.mock('./commands/generate-cron', () => ({ generateCron: jest.fn() }));
jest.mock('./commands/generate-rag', () => ({ generateRag: jest.fn() }));
jest.mock('./commands/generate-discovery', () => ({ generateDiscovery: jest.fn() }));
jest.mock('./commands/generate-setup', () => ({ generateSetup: jest.fn() }));

jest.mock('./commands/info', () => ({ infoCommand: jest.fn() }));
jest.mock('./commands/add', () => ({ addCommand: jest.fn() }));
jest.mock('./commands/build', () => ({ buildCommand: jest.fn() }));
jest.mock('./commands/pdf-to-audio', () => ({ pdfToAudioCommand: jest.fn() }));
jest.mock('./commands/start', () => ({ startCommand: jest.fn() }));
jest.mock('./commands/test', () => ({ testCommand: jest.fn() }));

describe('CLI generate --list', () => {
  let logSpy: jest.SpyInstance;

  beforeAll(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('prints a human list with --list', () => {
    process.argv = ['node', 'hazel', 'g', '--list'];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('Available generator types');
  });

  it('prints JSON with --list --list-json', () => {
    process.argv = ['node', 'hazel', 'g', '--list', '--list-json'];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('{"generators":');
  });

  it('prints usage when no args provided to generate', () => {
    // this triggers the action handler for generate without --list
    process.argv = ['node', 'hazel', 'g'];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');
    const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('Usage: hazel g <type> <name>');
  });
});

