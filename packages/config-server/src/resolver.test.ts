import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolvePropertySources } from './resolver';

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

describe('resolvePropertySources', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-cfg-src-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('applies override hierarchy', () => {
    writeTree(root, {
      'application.yml': 'server:\n  port: 8080\nshared: true\n',
      'application-prod.yml': 'server:\n  port: 80\n',
      'user-service.yml': 'name: users\n',
      'user-service-prod.yml': 'name: users-prod\n',
    });
    const sources = resolvePropertySources({
      root,
      application: 'user-service',
      profiles: ['prod'],
    });
    expect(sources.map((s) => s.name)).toEqual([
      'application.yml',
      'application-prod.yml',
      'user-service.yml',
      'user-service-prod.yml',
    ]);
    expect(sources[1].source).toEqual({ server: { port: 80 } });
  });

  it('reads extra searchPaths templates', () => {
    writeTree(root, {
      'configs/user-service/prod/application.yml': 'from: search-path\n',
    });
    const sources = resolvePropertySources({
      root,
      application: 'user-service',
      profiles: ['prod'],
      searchPaths: ['configs/{application}/{profile}'],
    });
    expect(sources.some((s) => s.source.from === 'search-path')).toBe(true);
  });

  it('skips missing directories', () => {
    const sources = resolvePropertySources({
      root,
      application: 'missing',
      profiles: ['dev'],
      searchPaths: ['nope/{application}'],
    });
    expect(sources).toEqual([]);
  });

  it('reads searchPaths without a profile list', () => {
    writeTree(root, {
      'configs/app/application.yml': 'loose: true\n',
    });
    const sources = resolvePropertySources({
      root,
      application: 'app',
      profiles: [],
      searchPaths: ['configs/{application}'],
    });
    expect(sources.some((s) => s.source.loose === true)).toBe(true);
  });
});
