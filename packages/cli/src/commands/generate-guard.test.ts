import fs from 'fs';
import { Command } from 'commander';
import { generateGuard } from './generate-guard';

jest.mock('fs');

describe('generateGuard', () => {
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

  it('should register the guard command with alias', () => {
    generateGuard(program);
    const cmd = program.commands.find(c => c.name() === 'guard');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('gu');
  });

  it('should generate a guard file with correct suffix', async () => {
    generateGuard(program);
    await program.parseAsync(['node', 'test', 'guard', 'auth']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('auth.guard.ts'),
      expect.stringContaining('AuthGuard'),
    );
  });

  it('should include CanActivate interface', async () => {
    generateGuard(program);
    await program.parseAsync(['node', 'test', 'guard', 'auth']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('CanActivate');
    expect(writtenContent).toContain('canActivate');
  });
});
