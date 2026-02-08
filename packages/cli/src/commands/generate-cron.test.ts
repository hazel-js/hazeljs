import fs from 'fs';
import { Command } from 'commander';
import { generateCron } from './generate-cron';

jest.mock('fs');

describe('generateCron', () => {
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

  it('should register the cron command with alias', () => {
    generateCron(program);
    const cmd = program.commands.find(c => c.name() === 'cron');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('job');
  });

  it('should generate a cron service file', async () => {
    generateCron(program);
    await program.parseAsync(['node', 'test', 'cron', 'cleanup']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('cleanup.cron.ts'),
      expect.stringContaining('CleanupCronService'),
    );
  });

  it('should import from @hazeljs/cron', async () => {
    generateCron(program);
    await program.parseAsync(['node', 'test', 'cron', 'cleanup']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/cron'");
    expect(writtenContent).toContain('@Cron');
    expect(writtenContent).toContain('CronExpression');
  });
});
