import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FilesystemConfigSource, GitConfigSource } from './git-backend';

function initGitRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-git-origin-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@hazeljs.ai'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Hazel Test'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  return dir;
}

describe('FilesystemConfigSource', () => {
  it('returns the directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-fs-'));
    const source = new FilesystemConfigSource(dir, 'main');
    const result = await source.sync();
    expect(result.dir).toBe(dir);
    expect(result.label).toBe('main');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('throws when the directory is missing', async () => {
    const source = new FilesystemConfigSource('/tmp/hazeljs-does-not-exist-cfg');
    await expect(source.sync()).rejects.toThrow(/does not exist/);
  });

  it('requires nativePath', () => {
    expect(() => new FilesystemConfigSource('')).toThrow(/nativePath/);
  });
});

describe('GitConfigSource', () => {
  it('requires uri', () => {
    expect(() => new GitConfigSource({ uri: '' })).toThrow(/git.uri/);
  });

  it('clones a local repo, checks out main, and pulls on refresh', async () => {
    const origin = initGitRepo({ 'application.yml': 'from: origin\n' });
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-git-clone-'));
    fs.rmSync(cloneDir, { recursive: true, force: true });
    const source = new GitConfigSource({ uri: origin, cloneDir, defaultLabel: 'main' });
    const first = await source.sync('main');
    expect(first.version).toMatch(/^[a-f0-9]+$/);
    expect(fs.existsSync(path.join(cloneDir, 'application.yml'))).toBe(true);

    fs.writeFileSync(path.join(origin, 'application.yml'), 'from: updated\n');
    execFileSync('git', ['add', '.'], { cwd: origin });
    execFileSync('git', ['commit', '-m', 'update'], { cwd: origin });

    const second = await source.sync('main');
    expect(second.version).not.toBe(first.version);
    expect(fs.readFileSync(path.join(cloneDir, 'application.yml'), 'utf8')).toContain('updated');

    expect(source.describe()).toBe(path.resolve(origin));
    await source.close();
    fs.rmSync(origin, { recursive: true, force: true });
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }, 30_000);

  it('redacts credentials in describe()', () => {
    const source = new GitConfigSource({
      uri: 'https://example.com/org/config.git',
      username: 'user',
      password: 'token',
      cloneDir: path.join(os.tmpdir(), `hazel-git-never-${Date.now()}`),
    });
    expect(source.describe()).toBe('https://***@example.com/org/config.git');
  });

  it('replaces a non-git cloneDir with a fresh clone', async () => {
    const origin = initGitRepo({ 'application.yml': 'ok: true\n' });
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-git-empty-'));
    fs.writeFileSync(path.join(cloneDir, 'stale.txt'), 'nope');
    const local = new GitConfigSource({ uri: origin, cloneDir });
    const result = await local.sync('main');
    expect(fs.existsSync(path.join(result.dir, 'application.yml'))).toBe(true);
    expect(fs.existsSync(path.join(result.dir, 'stale.txt'))).toBe(false);
    await local.close();
    fs.rmSync(origin, { recursive: true, force: true });
    fs.rmSync(cloneDir, { recursive: true, force: true });
  }, 30_000);
});
