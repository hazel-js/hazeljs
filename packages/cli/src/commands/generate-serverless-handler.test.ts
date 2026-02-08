import fs from 'fs';
import { Command } from 'commander';
import { generateServerlessHandler } from './generate-serverless-handler';

jest.mock('fs');

describe('generateServerlessHandler', () => {
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

  it('should register the serverless command with alias', () => {
    generateServerlessHandler(program);
    const cmd = program.commands.find(c => c.name() === 'serverless');
    expect(cmd).toBeDefined();
    expect(cmd?.alias()).toBe('sls');
  });

  it('should generate a lambda handler by default', async () => {
    generateServerlessHandler(program);
    await program.parseAsync(['node', 'test', 'serverless', 'api']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('createLambdaHandler');
    expect(writtenContent).toContain("from '@hazeljs/serverless'");
  });

  it('should generate a cloud function handler', async () => {
    generateServerlessHandler(program);
    await program.parseAsync(['node', 'test', 'serverless', 'api', '--platform', 'cloud-function']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('createCloudFunctionHandler');
  });
});
