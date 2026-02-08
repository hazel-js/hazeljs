import fs from 'fs';
import { Command } from 'commander';
import { generateMiddleware } from './generate-middleware';

jest.mock('fs');

describe('generateMiddleware', () => {
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

  it('should register the middleware command with alias', () => {
    generateMiddleware(program);
    const cmd = program.commands.find(c => c.name() === 'middleware');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('mw');
  });

  it('should generate a middleware file with correct suffix', async () => {
    generateMiddleware(program);
    await program.parseAsync(['node', 'test', 'middleware', 'logger']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('logger.middleware.ts'),
      expect.stringContaining('LoggerMiddleware'),
    );
  });

  it('should import from @hazeljs/core not express', async () => {
    generateMiddleware(program);
    await program.parseAsync(['node', 'test', 'middleware', 'logger']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/core'");
    expect(writtenContent).not.toContain("from 'express'");
  });
});
