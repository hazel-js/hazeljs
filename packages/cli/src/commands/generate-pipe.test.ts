import fs from 'fs';
import { Command } from 'commander';
import { generatePipe } from './generate-pipe';

jest.mock('fs');

describe('generatePipe', () => {
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

  it('should generate a pipe file with correct suffix', async () => {
    generatePipe(program);
    await program.parseAsync(['node', 'test', 'pipe', 'validation']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('validation.pipe.ts'),
      expect.stringContaining('ValidationPipe'),
    );
  });

  it('should implement PipeTransform interface', async () => {
    generatePipe(program);
    await program.parseAsync(['node', 'test', 'pipe', 'validation']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('PipeTransform');
    expect(writtenContent).toContain('transform');
  });
});
