import fs from 'fs';
import { Command } from 'commander';
import { generateAuth } from './generate-auth';

jest.mock('fs');

describe('generateAuth', () => {
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

  it('should generate all auth files', async () => {
    generateAuth(program);
    await program.parseAsync(['node', 'test', 'auth']);

    const writtenFiles = mockFs.writeFileSync.mock.calls.map(call => call[0] as string);
    expect(writtenFiles.some(f => f.includes('auth.module.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('auth.service.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('auth.controller.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('jwt-auth.guard.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('register.dto.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('login.dto.ts'))).toBe(true);
  });

  it('should use @hazeljs/auth imports in guard', async () => {
    generateAuth(program);
    await program.parseAsync(['node', 'test', 'auth']);

    const guardContent = mockFs.writeFileSync.mock.calls
      .find(call => (call[0] as string).includes('jwt-auth.guard'))?.[1] as string;
    expect(guardContent).toContain("from '@hazeljs/auth'");
    expect(guardContent).toContain('JwtService');
  });

  it('should support --dry-run flag', async () => {
    generateAuth(program);
    await program.parseAsync(['node', 'test', 'auth', '--dry-run']);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
