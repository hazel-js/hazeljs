import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { infoCommand } from './info';

jest.mock('fs');

describe('infoCommand', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let logSpy: jest.SpyInstance;

  beforeAll(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.readdirSync.mockReturnValue(['a.ts', 'dir'] as any);
    mockFs.statSync.mockImplementation((p: any) => {
      const s = String(p);
      return { isDirectory: () => s.endsWith('dir') } as any;
    });
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        name: 'demo',
        version: '1.0.0',
        description: 'desc',
        dependencies: { '@hazeljs/core': '^0.2.0', lodash: '^4.0.0' },
        devDependencies: { '@hazeljs/swagger': '^0.2.0' },
      }) as any
    );

    mockFs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith(path.join(process.cwd(), 'package.json'))) return true;
      if (s.endsWith(path.join(process.cwd(), 'src'))) return true;
      // pretend some config files exist
      if (s.endsWith('tsconfig.json')) return true;
      return false;
    });
  });

  it('prints hazel packages and project structure', async () => {
    const program = new Command();
    infoCommand(program);
    await program.parseAsync(['info'], { from: 'user' });
    const out = logSpy.mock.calls
      .map((c) => c.map((x: unknown) => String(x)).join(' '))
      .join('\n');
    expect(out).toContain('Project Information');
    expect(out).toContain('@hazeljs/core');
    expect(out).toContain('@hazeljs/swagger');
    expect(out).toContain('Project Structure');
  });
});

