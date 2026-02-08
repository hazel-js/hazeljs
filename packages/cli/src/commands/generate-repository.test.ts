import fs from 'fs';
import { Command } from 'commander';
import { generateRepository } from './generate-repository';

jest.mock('fs');

describe('generateRepository', () => {
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

  it('should register the repository command with alias', () => {
    generateRepository(program);
    const cmd = program.commands.find(c => c.name() === 'repository');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('repo');
  });

  it('should generate a repository file with correct suffix', async () => {
    generateRepository(program);
    await program.parseAsync(['node', 'test', 'repository', 'user']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('user.repository.ts'),
      expect.stringContaining('UserRepository'),
    );
  });

  it('should import from @hazeljs/prisma', async () => {
    generateRepository(program);
    await program.parseAsync(['node', 'test', 'repository', 'user']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/prisma'");
    expect(writtenContent).toContain('BaseRepository');
  });
});
