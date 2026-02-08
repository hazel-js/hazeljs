import { execSync } from 'child_process';
import { Command } from 'commander';
import { addCommand } from './add';

jest.mock('child_process');
jest.mock('inquirer');

describe('addCommand', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecSync.mockImplementation(() => Buffer.from(''));
    jest.spyOn(console, 'log').mockImplementation();
    program = new Command();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register the add command', () => {
    addCommand(program);
    const cmd = program.commands.find(c => c.name() === 'add');
    expect(cmd).toBeDefined();
  });

  it('should install a known package', async () => {
    addCommand(program);
    await program.parseAsync(['node', 'test', 'add', 'auth']);

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('@hazeljs/auth'),
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('should handle unknown packages gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    addCommand(program);
    await program.parseAsync(['node', 'test', 'add', 'unknown-package']);

    expect(mockExecSync).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown package'));
    consoleSpy.mockRestore();
  });

  it('should include all hazeljs packages', async () => {
    addCommand(program);

    // Test that all documented packages are available
    const expectedPackages = [
      'ai', 'agent', 'auth', 'cache', 'config', 'cron',
      'discovery', 'prisma', 'rag', 'serverless', 'swagger', 'websocket'
    ];

    for (const pkg of expectedPackages) {
      mockExecSync.mockClear();
      await program.parseAsync(['node', 'test', 'add', pkg]);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(`@hazeljs/${pkg}`),
        expect.any(Object),
      );
    }
  });
});
