import fs from 'fs';
import path from 'path';
import { runApp } from './generate-app';

jest.mock('fs');

describe('runApp (skeleton app)', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.mkdirSync.mockImplementation(() => undefined as any);
    mockFs.writeFileSync.mockImplementation(() => undefined as any);
    mockFs.copyFileSync.mockImplementation(() => undefined as any);
    mockFs.readdirSync.mockReturnValue([] as any);
    mockFs.lstatSync.mockReturnValue({ isDirectory: () => false } as any);
  });

  it('should return dry-run result without touching fs', async () => {
    const result = await runApp('my-app', { path: '.', dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.created[0]).toContain(path.join(process.cwd(), 'my-app'));
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should fail if destination already exists', async () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = await runApp('my-app', { path: '.', dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Destination already exists');
  });

  it('should create skeleton when destination does not exist', async () => {
    // destPath doesn't exist; templatePath also doesn't exist -> fallback basic structure
    mockFs.existsSync.mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith(path.join('.', 'my-app')) || s.endsWith(path.join(process.cwd(), '.', 'my-app'))) return false;
      if (s.includes('@template')) return false;
      return false;
    });

    const result = await runApp('my-app', { path: '.', dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(1);
    expect(mockFs.mkdirSync).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalled();
    expect(result.nextSteps).toEqual(['cd my-app', 'npm install', 'npm run dev']);
  });
});

