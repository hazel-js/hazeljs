// Mock generators so requiring ./index doesn't do real work
jest.mock('./commands/generate-app', () => ({
  generateApp: jest.fn(),
  registerGenerateApp: jest.fn(),
}));
jest.mock('./commands/generate-module', () => ({ generateModule: jest.fn() }));
jest.mock('./commands/generate-dto', () => ({ generateDto: jest.fn() }));
jest.mock('./commands/generate-crud', () => ({ generateCrud: jest.fn() }));
jest.mock('./commands/generate-auth', () => ({ generateAuth: jest.fn() }));
jest.mock('./commands/generate-simple', () => ({
  registerSimpleGenerators: jest.fn(),
  SIMPLE_GENERATORS: [
    {
      type: 'controller',
      description: 'REST controller',
      suffix: 'controller',
      template: '',
      nameRequired: true,
    },
  ],
  findSimpleGenerator: jest.fn(),
  runSimpleGenerator: jest.fn(),
}));

jest.mock('./commands/info', () => ({ infoCommand: jest.fn() }));
jest.mock('./commands/add', () => ({ addCommand: jest.fn() }));

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
