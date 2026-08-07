import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createAgentPackageRegistry,
  LocalFsAgentRegistryAdapter,
  InMemoryAgentPackageRegistry,
  exportAgentDna,
  toMarketplacePackage,
  parsePackageSpec,
  sanitizePackageName,
} from '../../src';

function samplePkg(name: string, version: string, description?: string) {
  const pkg = toMarketplacePackage(
    exportAgentDna({ name: name.replace(/^@.*\//, ''), version, tools: [{ name: 'ping' }] })
  );
  pkg.name = name;
  pkg.version = version;
  if (description) pkg.description = description;
  return pkg;
}

describe('createAgentPackageRegistry', () => {
  const prevUrl = process.env.HAZEL_REGISTRY_URL;
  const prevToken = process.env.HAZEL_REGISTRY_TOKEN;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.HAZEL_REGISTRY_URL;
    else process.env.HAZEL_REGISTRY_URL = prevUrl;
    if (prevToken === undefined) delete process.env.HAZEL_REGISTRY_TOKEN;
    else process.env.HAZEL_REGISTRY_TOKEN = prevToken;
  });

  it('returns memory registry when memory: true', () => {
    const reg = createAgentPackageRegistry({ memory: true });
    expect(reg.kind).toBe('memory');
    expect(reg.location).toBe('memory://');
  });

  it('uses HAZEL_REGISTRY_URL when remote is omitted', () => {
    process.env.HAZEL_REGISTRY_URL = ' https://env-registry.test/ ';
    process.env.HAZEL_REGISTRY_TOKEN = 'env-token';
    const reg = createAgentPackageRegistry({
      fetch: async () => new Response('{}'),
    });
    expect(reg.kind).toBe('remote');
    expect(reg.location).toBe('https://env-registry.test');
  });

  it('falls back to local fs adapter', async () => {
    delete process.env.HAZEL_REGISTRY_URL;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-reg-'));
    try {
      const reg = createAgentPackageRegistry({ registryRoot: path.join(tmp, 'r') });
      expect(reg.kind).toBe('local');
      const pkg = samplePkg('@hazeljs/demo-agent', '1.0.0');
      await reg.publish(pkg);
      const got = await reg.get('@hazeljs/demo-agent');
      expect(got.version).toBe('1.0.0');
      expect(await reg.list('demo')).toHaveLength(1);
      const report = await reg.doctor();
      expect(report.ok).toBe(true);
      await reg.remove('@hazeljs/demo-agent', '1.0.0');
      await expect(reg.get('@hazeljs/demo-agent')).rejects.toThrow();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('LocalFsAgentRegistryAdapter', () => {
  it('exposes rootDir and supports list without query', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-adapter-'));
    try {
      const adapter = new LocalFsAgentRegistryAdapter({ rootDir: path.join(tmp, 'reg') });
      expect(adapter.rootDir).toContain('reg');
      expect(adapter.location).toBe(adapter.rootDir);
      expect(await adapter.list()).toEqual([]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('InMemoryAgentPackageRegistry edges', () => {
  it('resolves latest, filters list, and removes versions', async () => {
    const mem = new InMemoryAgentPackageRegistry();
    await mem.publish(samplePkg('@hazeljs/a', '1.0.0', 'alpha'));
    await mem.publish(samplePkg('@hazeljs/a', '2.0.0', 'beta'));
    await mem.publish(samplePkg('@hazeljs/b', '0.1.0', 'other'));

    expect((await mem.get('@hazeljs/a')).version).toBe('2.0.0');
    expect((await mem.get('@hazeljs/a', 'latest')).version).toBe('2.0.0');
    expect((await mem.get('@hazeljs/a', '1.0.0')).version).toBe('1.0.0');

    expect(await mem.list()).toHaveLength(2);
    expect(await mem.list('  ')).toHaveLength(2);
    expect(await mem.list('beta')).toHaveLength(1);
    expect(await mem.list('nope')).toHaveLength(0);

    await mem.remove('@hazeljs/a', '1.0.0');
    await expect(mem.get('@hazeljs/a', '1.0.0')).rejects.toThrow(/Version 1.0.0/);
    await mem.remove('@hazeljs/a', '2.0.0');
    await expect(mem.get('@hazeljs/a')).rejects.toThrow(/not found/);
    await expect(mem.remove('@hazeljs/missing')).rejects.toThrow(/not found/);
    await expect(mem.remove('@hazeljs/b', '9.9.9')).rejects.toThrow(/Version 9.9.9/);
    await mem.remove('@hazeljs/b');
    expect(await mem.list()).toHaveLength(0);
    expect((await mem.doctor()).ok).toBe(true);
  });
});

describe('parsePackageSpec edge cases', () => {
  it('handles bare names, empty versions, and scoped without version', () => {
    expect(parsePackageSpec('plain-agent')).toEqual({ name: 'plain-agent' });
    expect(parsePackageSpec('plain-agent@')).toEqual({ name: 'plain-agent', version: undefined });
    expect(parsePackageSpec('plain-agent@1.2.3')).toEqual({
      name: 'plain-agent',
      version: '1.2.3',
    });
    expect(parsePackageSpec('@only-scope')).toEqual({ name: '@only-scope' });
    expect(parsePackageSpec('@hazeljs/agent@')).toEqual({
      name: '@hazeljs/agent',
      version: undefined,
    });
    expect(sanitizePackageName('weird name/@x')).toBe('weird_name___x');
  });
});
