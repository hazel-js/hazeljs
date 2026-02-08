import fs from 'fs';
import { Command } from 'commander';
import { generateConfig } from './generate-config';

jest.mock('fs');

describe('generateConfig', () => {
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

  it('should generate a config module file', async () => {
    generateConfig(program);
    await program.parseAsync(['node', 'test', 'config']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('app.config.ts'),
      expect.stringContaining('ConfigModule'),
    );
  });

  it('should import from @hazeljs/config', async () => {
    generateConfig(program);
    await program.parseAsync(['node', 'test', 'config']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/config'");
    expect(writtenContent).toContain('ConfigService');
  });
});
