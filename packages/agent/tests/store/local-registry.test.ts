import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  exportAgentDna,
  toMarketplacePackage,
  validateMarketplacePackage,
  LocalFsAgentRegistry,
  materializeAgentPackage,
  parsePackageSpec,
  sanitizePackageName,
  loadMarketplacePackage,
  saveMarketplacePackage,
} from '../../src';

describe('validateMarketplacePackage', () => {
  it('accepts a valid marketplace package', () => {
    const dna = exportAgentDna({ name: 'demo', tools: [{ name: 'ping' }] });
    const pkg = toMarketplacePackage(dna);
    const result = validateMarketplacePackage(pkg);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing name / version / dna', () => {
    expect(validateMarketplacePackage({}).ok).toBe(false);
    expect(validateMarketplacePackage({ name: 'x', version: '1.0.0' }).ok).toBe(false);
    expect(
      validateMarketplacePackage({
        name: 'x',
        version: '1.0.0',
        dna: { format: 'wrong', name: 'x' },
      }).ok
    ).toBe(false);
  });
});

describe('parsePackageSpec / sanitizePackageName', () => {
  it('parses scoped name@version', () => {
    expect(parsePackageSpec('@hazeljs/support-desk-agent@1.0.0')).toEqual({
      name: '@hazeljs/support-desk-agent',
      version: '1.0.0',
    });
    expect(parsePackageSpec('@hazeljs/support-desk-agent')).toEqual({
      name: '@hazeljs/support-desk-agent',
    });
  });

  it('sanitizes scoped names for FS', () => {
    expect(sanitizePackageName('@hazeljs/foo-agent')).toBe('hazeljs__foo-agent');
  });
});

describe('LocalFsAgentRegistry + materialize', () => {
  let tmp: string;
  let registry: LocalFsAgentRegistry;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-registry-'));
    registry = new LocalFsAgentRegistry({ rootDir: path.join(tmp, 'registry') });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('publishes, lists, resolves, and removes packages', () => {
    const dna = exportAgentDna({
      name: 'support-desk',
      version: '1.0.0',
      tools: [{ name: 'lookupOrder' }],
    });
    const pkg = toMarketplacePackage(dna);
    pkg.name = '@hazeljs/support-desk-agent';

    registry.publish(pkg);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list('support')[0]?.name).toBe('@hazeljs/support-desk-agent');

    const got = registry.resolve('@hazeljs/support-desk-agent');
    expect(got.version).toBe('1.0.0');
    expect(got.dna.name).toBe('support-desk');

    const v2 = { ...pkg, version: '1.1.0', dna: { ...pkg.dna, version: '1.1.0' } };
    registry.publish(v2);
    expect(registry.resolve('@hazeljs/support-desk-agent', 'latest').version).toBe('1.1.0');
    expect(registry.resolve('@hazeljs/support-desk-agent', '1.0.0').version).toBe('1.0.0');

    registry.remove('@hazeljs/support-desk-agent', '1.0.0');
    expect(registry.list()[0]?.versions).toEqual(['1.1.0']);

    registry.remove('@hazeljs/support-desk-agent');
    expect(registry.list()).toHaveLength(0);
  });

  it('materializes into .hazel/agents with lock.json', () => {
    const dna = exportAgentDna({ name: 'desk', tools: [] });
    const pkg = toMarketplacePackage(dna);
    pkg.name = '@hazeljs/desk-agent';

    const project = path.join(tmp, 'project');
    fs.mkdirSync(project);
    const result = materializeAgentPackage(pkg, project);

    expect(fs.existsSync(result.packagePath)).toBe(true);
    expect(fs.existsSync(result.lockPath)).toBe(true);
    const lock = JSON.parse(fs.readFileSync(result.lockPath, 'utf8')) as Record<
      string,
      { version: string; path: string }
    >;
    expect(lock['@hazeljs/desk-agent']?.version).toBe(pkg.version);
    const loaded = loadMarketplacePackage(result.packagePath);
    expect(loaded.name).toBe('@hazeljs/desk-agent');
  });

  it('loadMarketplacePackage fails closed on invalid DNA format', () => {
    const bad = path.join(tmp, 'bad.json');
    fs.writeFileSync(
      bad,
      JSON.stringify({ name: 'x', version: '1.0.0', dna: { format: 'nope', name: 'x' } })
    );
    expect(() => loadMarketplacePackage(bad)).toThrow(/Invalid/);
  });

  it('doctor reports registry health', () => {
    const report = registry.doctor();
    expect(report.ok).toBe(true);
    expect(report.checks.some((c) => c.name === 'registry_root' && c.ok)).toBe(true);
  });

  it('round-trips via saveMarketplacePackage', () => {
    const dna = exportAgentDna({ name: 'round', tools: [{ name: 't' }] });
    const pkg = toMarketplacePackage(dna);
    const file = path.join(tmp, 'out.marketplace.json');
    saveMarketplacePackage(pkg, file);
    const loaded = loadMarketplacePackage(file);
    expect(loaded.dna.name).toBe('round');
  });
});
