import fs from 'fs';
import { Command } from 'commander';
import { generateDiscovery } from './generate-discovery';

jest.mock('fs');

describe('generateDiscovery', () => {
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

  it('should generate a discovery service file', async () => {
    generateDiscovery(program);
    await program.parseAsync(['node', 'test', 'discovery', 'app']);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('app.discovery.ts'),
      expect.stringContaining('AppDiscoveryService'),
    );
  });

  it('should import from @hazeljs/discovery', async () => {
    generateDiscovery(program);
    await program.parseAsync(['node', 'test', 'discovery', 'app']);

    const writtenContent = mockFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain("from '@hazeljs/discovery'");
    expect(writtenContent).toContain('ServiceRegistry');
    expect(writtenContent).toContain('DiscoveryClient');
  });
});
