import {
  InMemoryAgentPackageRegistry,
  HttpAgentPackageRegistry,
  createMemoryRegistryFetch,
  createAgentPackageRegistry,
  createCompositePackageResolver,
  exportAgentDna,
  toMarketplacePackage,
  PLATFORM_API_VERSION,
  parsePlatformResource,
  createLocalPlatform,
} from '../../src';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('hosted registry (Cloud Team SKU client)', () => {
  it('publishes and resolves via HTTP mock', async () => {
    const memory = new InMemoryAgentPackageRegistry();
    const remote = new HttpAgentPackageRegistry({
      baseUrl: 'https://registry.test',
      token: 'test-token',
      fetch: createMemoryRegistryFetch(memory),
    });

    const pkg = toMarketplacePackage(
      exportAgentDna({ name: 'support', version: '1.2.0', tools: [{ name: 'ping' }] })
    );
    pkg.name = '@hazeljs/support-agent';
    await remote.publish(pkg);

    const got = await remote.get('@hazeljs/support-agent', '1.2.0');
    expect(got.version).toBe('1.2.0');
    expect(got.dna.name).toBe('support');

    const listed = await remote.list('support');
    expect(listed.some((p) => p.name === '@hazeljs/support-agent')).toBe(true);

    const health = await remote.doctor();
    expect(health.ok).toBe(true);
  });

  it('createAgentPackageRegistry prefers remote URL', () => {
    const reg = createAgentPackageRegistry({
      remote: 'https://registry.example',
      token: 'x',
      fetch: async () => new Response('{}'),
    });
    expect(reg.kind).toBe('remote');
    expect(reg.location).toBe('https://registry.example');
  });

  it('composite resolver falls back to remote after local miss', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-remote-'));
    try {
      const memory = new InMemoryAgentPackageRegistry();
      const pkg = toMarketplacePackage(
        exportAgentDna({ name: 'remote-only', version: '9.0.0', tools: [] })
      );
      pkg.name = '@hazeljs/remote-only-agent';
      await memory.publish(pkg);

      const remote = new HttpAgentPackageRegistry({
        baseUrl: 'https://registry.test',
        fetch: createMemoryRegistryFetch(memory),
      });

      const resolver = createCompositePackageResolver({
        projectRoot: tmp,
        registryRoot: path.join(tmp, 'empty-reg'),
        remoteRegistry: remote,
      });

      const resolved = await resolver({ name: '@hazeljs/remote-only-agent' });
      expect(resolved.source).toBe('remote');
      expect(resolved.version).toBe('9.0.0');
      expect(resolved.dna.name).toBe('remote-only');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('platform apply resolves packageRef from remote registry', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-plat-remote-'));
    try {
      const memory = new InMemoryAgentPackageRegistry();
      const pkg = toMarketplacePackage(
        exportAgentDna({ name: 'cloud-desk', version: '3.0.0', tools: [{ name: 'a' }] })
      );
      pkg.name = '@hazeljs/cloud-desk-agent';
      await memory.publish(pkg);
      const remote = new HttpAgentPackageRegistry({
        baseUrl: 'https://registry.test',
        fetch: createMemoryRegistryFetch(memory),
      });

      const platform = createLocalPlatform({
        storePath: path.join(tmp, 'resources.json'),
        projectRoot: tmp,
        registryRoot: path.join(tmp, 'empty'),
        remoteRegistry: remote,
        events: false,
        admission: false,
      });

      const result = await platform.reconciler.applyResource(
        parsePlatformResource({
          apiVersion: PLATFORM_API_VERSION,
          kind: 'AgentDefinition',
          metadata: { name: 'from-cloud' },
          spec: { packageRef: { name: '@hazeljs/cloud-desk-agent' } },
        })
      );
      expect(result.ready).toBe(true);
      expect(result.resource.status?.backend?.packageSource).toBe('remote');
      expect(result.resource.status?.backend?.dnaName).toBe('cloud-desk');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
