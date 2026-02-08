import fs from 'fs';
import { Command } from 'commander';
import { generateInterceptor } from './generate-interceptor';

jest.mock('fs');

describe('generateInterceptor', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation();
    program = new Command();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register the interceptor command with alias', () => {
    generateInterceptor(program);
    const cmd = program.commands.find(c => c.name() === 'interceptor');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('i');
  });

  it('should generate an interceptor file with correct suffix', async () => {
    generateInterceptor(program);
    await program.parseAsync(['node', 'test', 'interceptor', 'logging']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('logging.interceptor.ts'),
      expect.stringContaining('LoggingInterceptor'),
    );
  });

  it('should implement the Interceptor interface', async () => {
    generateInterceptor(program);
    await program.parseAsync(['node', 'test', 'interceptor', 'logging']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('implements Interceptor');
    expect(writtenContent).toContain('intercept');
  });
});
