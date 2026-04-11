import { Command } from 'commander';
import { generateModule } from './commands/generate-module';
import { generateDto } from './commands/generate-dto';
import { generateCrud } from './commands/generate-crud';
import { generateAuth } from './commands/generate-auth';
import { registerSimpleGenerators } from './commands/generate-simple';

jest.mock('./commands/generate-app', () => ({
  generateApp: jest.fn(),
  registerGenerateApp: jest.fn(),
}));
jest.mock('./commands/generate-module');
jest.mock('./commands/generate-dto');
jest.mock('./commands/generate-crud');
jest.mock('./commands/generate-auth');
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

  it('should register complex and simple generator commands', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./index');

    // Complex generators
    expect(generateModule).toHaveBeenCalled();
    expect(generateDto).toHaveBeenCalled();
    expect(generateCrud).toHaveBeenCalled();
    expect(generateAuth).toHaveBeenCalled();

    // Simple generators (config-driven)
    expect(registerSimpleGenerators).toHaveBeenCalled();
  });

  it('should have generate command with alias g', () => {
    const program = new Command();
    program.name('hazel').description('CLI for generating HazelJS components').version('0.2.0');
    const generate = program.command('generate').description('Generate a new component').alias('g');
    generateModule(generate);
    expect(generate.alias()).toBe('g');
  });
});
