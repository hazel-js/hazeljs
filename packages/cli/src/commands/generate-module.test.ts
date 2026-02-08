import fs from 'fs';
import { Command } from 'commander';
import { generateModule } from './generate-module';

jest.mock('fs');

describe('generateModule', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let program: Command;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation();
    program = new Command();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should register the module command with alias', () => {
    generateModule(program);
    const cmd = program.commands.find(c => c.name() === 'module');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('m');
  });

  it('should generate all module files', async () => {
    generateModule(program);
    await program.parseAsync(['node', 'test', 'module', 'user']);

    const writtenFiles = mockFs.writeFileSync.mock.calls.map(call => call[0] as string);
    expect(writtenFiles.some(f => f.includes('user.module.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('user.controller.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('user.service.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('create-user.dto.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('update-user.dto.ts'))).toBe(true);
  });

  it('should use @hazeljs/core imports in all generated files', async () => {
    generateModule(program);
    await program.parseAsync(['node', 'test', 'module', 'user']);

    const writtenContents = mockFs.writeFileSync.mock.calls.map(call => call[1] as string);
    const moduleContent = writtenContents.find(c => c.includes('HazelModule'));
    expect(moduleContent).toContain("from '@hazeljs/core'");
    
    const controllerContent = writtenContents.find(c => c.includes('Controller'));
    expect(controllerContent).toContain("from '@hazeljs/core'");
  });

  it('should support --dry-run flag', async () => {
    generateModule(program);
    await program.parseAsync(['node', 'test', 'module', 'user', '--dry-run']);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
