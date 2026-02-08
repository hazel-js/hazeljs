import fs from 'fs';
import { Command } from 'commander';
import { generateController } from './generate-controller';

jest.mock('fs');

describe('generateController', () => {
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

  it('should register the controller command with alias', () => {
    generateController(program);
    const cmd = program.commands.find(c => c.name() === 'controller');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('c');
  });

  it('should generate a controller file with correct suffix', async () => {
    generateController(program);
    await program.parseAsync(['node', 'test', 'controller', 'user']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('user.controller.ts'),
      expect.stringContaining('UserController'),
    );
  });

  it('should include proper imports from @hazeljs/core', async () => {
    generateController(program);
    await program.parseAsync(['node', 'test', 'controller', 'user']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/core'");
    expect(writtenContent).toContain('Controller');
    expect(writtenContent).toContain('Get');
    expect(writtenContent).toContain('Post');
  });

  it('should support --dry-run flag', async () => {
    generateController(program);
    await program.parseAsync(['node', 'test', 'controller', 'user', '--dry-run']);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
