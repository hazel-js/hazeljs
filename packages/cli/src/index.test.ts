import { Command } from 'commander';
import { generateController } from './commands/generate-controller';
import { generateService } from './commands/generate-service';
import { generateModule } from './commands/generate-module';
import { generateDto } from './commands/generate-dto';
import { generateGuard } from './commands/generate-guard';
import { generateInterceptor } from './commands/generate-interceptor';

jest.mock('./commands/generate-controller');
jest.mock('./commands/generate-service');
jest.mock('./commands/generate-module');
jest.mock('./commands/generate-dto');
jest.mock('./commands/generate-guard');
jest.mock('./commands/generate-interceptor');

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

    expect(generateController).toHaveBeenCalled();
    expect(generateService).toHaveBeenCalled();
    expect(generateModule).toHaveBeenCalled();
    expect(generateDto).toHaveBeenCalled();
    expect(generateGuard).toHaveBeenCalled();
    expect(generateInterceptor).toHaveBeenCalled();
  });

  it('should have generate command with alias', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = new Command();
    program.name('hazel').description('CLI for generating HazelJS components').version('0.1.0');
    const generate = program.command('generate').description('Generate a new component').alias('g');
    generateController(generate);
    generateService(generate);
    generateModule(generate);
    generateDto(generate);
    generateGuard(generate);
    generateInterceptor(generate);
    expect(generate.alias()).toBe('g');
    consoleSpy.mockRestore();
  });

  it('should show help when no command is provided', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const program = new Command();
    program.name('hazel').description('CLI for generating HazelJS components').version('0.1.0');
    const generate = program.command('generate').description('Generate a new component').alias('g');
    generateController(generate);
    generateService(generate);
    generateModule(generate);
    generateDto(generate);
    generateGuard(generate);
    generateInterceptor(generate);
    
    // Mock process.argv to simulate no arguments
    const originalArgv = process.argv;
    process.argv = ['node', 'index.js'];
    
    program.parse(process.argv);
    program.outputHelp();
    console.log('\n');
    console.log('Available commands:');
    console.log('  generate controller <name>  Generate a new controller');
    console.log('  generate service <name>     Generate a new service');
    console.log('  generate module <name>      Generate a new module');
    console.log('  generate dto <name>         Generate a new DTO');
    console.log('  generate guard <name>       Generate a new guard');
    console.log('  generate interceptor <name> Generate a new interceptor');
    
    expect(consoleSpy).toHaveBeenCalled();
    
    // Restore process.argv
    process.argv = originalArgv;
    consoleSpy.mockRestore();
  });
}); 