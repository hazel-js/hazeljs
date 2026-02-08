import fs from 'fs';
import { Command } from 'commander';
import { generateAIService } from './generate-ai-service';

jest.mock('fs');

describe('generateAIService', () => {
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

  it('should register the ai-service command with alias', () => {
    generateAIService(program);
    const cmd = program.commands.find(c => c.name() === 'ai-service');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('ai');
  });

  it('should generate an AI service file with correct suffix', async () => {
    generateAIService(program);
    await program.parseAsync(['node', 'test', 'ai-service', 'chat']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('chat.ai-service.ts'),
      expect.stringContaining('ChatAIService'),
    );
  });

  it('should import from @hazeljs/ai', async () => {
    generateAIService(program);
    await program.parseAsync(['node', 'test', 'ai-service', 'chat']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/ai'");
    expect(writtenContent).toContain('AIFunction');
  });
});
