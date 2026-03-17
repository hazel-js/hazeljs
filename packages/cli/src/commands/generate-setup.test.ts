import fs from 'fs';
import path from 'path';
import { runSetup, generateSetup } from './generate-setup';
import { Command } from 'commander';

jest.mock('fs');

describe('generateSetup', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
  });

  it('should register setup command with alias', () => {
    const program = new Command();
    generateSetup(program);
    const cmd = program.commands.find((c) => c.name() === 'setup');
    expect(cmd).toBeTruthy();
    expect(cmd?.aliases()).toContain('st');
  });

  it('runSetup should generate a setup file and include npm install in next steps', async () => {
    const result = await runSetup('swagger', { path: 'src', dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toBe(path.join(process.cwd(), 'src', 'swagger.setup.ts'));
    expect(result.nextSteps?.some((s) => s.includes('npm install @hazeljs/swagger'))).toBe(true);
  });

  it('runSetup should accept package names with and without @hazeljs prefix', async () => {
    const r1 = await runSetup('oauth', { path: 'src', dryRun: true });
    expect(r1.ok).toBe(true);
    expect(r1.dryRun).toBe(true);
    expect(r1.nextSteps?.some((s) => s.includes('npm install @hazeljs/oauth'))).toBe(true);

    const r2 = await runSetup('@hazeljs/oauth', { path: 'src', dryRun: true });
    expect(r2.ok).toBe(true);
    expect(r2.nextSteps?.some((s) => s.includes('npm install @hazeljs/oauth'))).toBe(true);
  });

  it('covers several common setup templates', async () => {
    const pkgs = ['grpc', 'graphql', 'kafka', 'resilience', 'mcp', 'pdf-to-audio'];
    for (const p of pkgs) {
      const result = await runSetup(p, { path: 'src', dryRun: true });
      expect(result.ok).toBe(true);
      expect(result.created[0]).toContain(`${p}.setup.ts`);
    }
  });
});

