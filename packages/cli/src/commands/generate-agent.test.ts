import fs from 'fs';
import { Command } from 'commander';
import { generateAgent } from './generate-agent';

jest.mock('fs');

describe('generateAgent', () => {
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

  it('should generate an agent file with correct suffix', async () => {
    generateAgent(program);
    await program.parseAsync(['node', 'test', 'agent', 'research']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('research.agent.ts'),
      expect.stringContaining('ResearchAgent'),
    );
  });

  it('should import from @hazeljs/agent', async () => {
    generateAgent(program);
    await program.parseAsync(['node', 'test', 'agent', 'research']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/agent'");
    expect(writtenContent).toContain('@Agent');
    expect(writtenContent).toContain('@Tool');
  });
});
