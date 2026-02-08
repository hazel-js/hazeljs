import fs from 'fs';
import { Command } from 'commander';
import { generateDto } from './generate-dto';

jest.mock('fs');

describe('generateDto', () => {
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

  it('should register the dto command with alias', () => {
    generateDto(program);
    const cmd = program.commands.find(c => c.name() === 'dto');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('d');
  });

  it('should generate both create and update DTOs', async () => {
    generateDto(program);
    await program.parseAsync(['node', 'test', 'dto', 'user']);

    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    const writtenFiles = mockFs.writeFileSync.mock.calls.map(call => call[0] as string);
    expect(writtenFiles.some(f => f.includes('user.dto.ts'))).toBe(true);
    expect(writtenFiles.some(f => f.includes('update-user.dto.ts'))).toBe(true);
  });

  it('should include class-validator decorators', async () => {
    generateDto(program);
    await program.parseAsync(['node', 'test', 'dto', 'user']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('class-validator');
    expect(writtenContent).toContain('IsString');
  });
});
