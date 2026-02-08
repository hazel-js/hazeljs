import fs from 'fs';
import { Command } from 'commander';
import { generateExceptionFilter } from './generate-exception-filter';

jest.mock('fs');

describe('generateExceptionFilter', () => {
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

  it('should register the filter command with alias', () => {
    generateExceptionFilter(program);
    const cmd = program.commands.find(c => c.name() === 'filter');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('f');
  });

  it('should generate a filter file with correct suffix', async () => {
    generateExceptionFilter(program);
    await program.parseAsync(['node', 'test', 'filter', 'http']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('http.filter.ts'),
      expect.stringContaining('HttpExceptionFilter'),
    );
  });

  it('should import correctly from @hazeljs/core', async () => {
    generateExceptionFilter(program);
    await program.parseAsync(['node', 'test', 'filter', 'http']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/core'");
    expect(writtenContent).toContain('Catch');
    expect(writtenContent).toContain('logger');
    expect(writtenContent).not.toContain("import logger from");
  });
});
