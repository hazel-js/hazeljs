import fs from 'fs';
import { Command } from 'commander';
import { generateService } from './generate-service';

jest.mock('fs');

describe('generateService', () => {
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

  it('should register the service command with alias', () => {
    generateService(program);
    const cmd = program.commands.find(c => c.name() === 'service');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('s');
  });

  it('should generate a service file with correct suffix', async () => {
    generateService(program);
    await program.parseAsync(['node', 'test', 'service', 'user']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('user.service.ts'),
      expect.stringContaining('UserService'),
    );
  });

  it('should include Injectable decorator', async () => {
    generateService(program);
    await program.parseAsync(['node', 'test', 'service', 'user']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('@Injectable()');
    expect(writtenContent).toContain("from '@hazeljs/core'");
  });
});
