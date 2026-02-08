import fs from 'fs';
import { Command } from 'commander';
import { generateRag } from './generate-rag';

jest.mock('fs');

describe('generateRag', () => {
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

  it('should generate a RAG service file', async () => {
    generateRag(program);
    await program.parseAsync(['node', 'test', 'rag', 'knowledge']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('knowledge.rag.ts'),
      expect.stringContaining('KnowledgeRagService'),
    );
  });

  it('should import from @hazeljs/rag', async () => {
    generateRag(program);
    await program.parseAsync(['node', 'test', 'rag', 'knowledge']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/rag'");
    expect(writtenContent).toContain('RAGPipeline');
  });
});
