import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  PlatformValidationError,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  parsePlatformDocuments,
  parsePlatformResource,
  createLocalPlatform,
  conditionOf,
  exportAgentDna,
  LocalFsAgentRegistry,
  toMarketplacePackage,
} from '../../src';

const DNA = exportAgentDna({
  name: 'support',
  systemPrompt: 'Help customers',
  tools: [{ name: 'lookup_order' }],
});

function definitionDoc(overrides?: Record<string, unknown>) {
  return {
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDefinition',
    metadata: { name: 'support-agent' },
    spec: { dna: DNA },
    ...overrides,
  };
}

function deploymentDoc(overrides?: Record<string, unknown>) {
  return {
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDeployment',
    metadata: { name: 'support' },
    spec: {
      definitionRef: { name: 'support-agent' },
      runtimeClassName: 'local',
    },
    ...overrides,
  };
}

describe('platform schemas', () => {
  it('parses AgentDefinition and AgentDeployment from JSON', () => {
    const docs = parsePlatformDocuments(JSON.stringify([definitionDoc(), deploymentDoc()]));
    expect(docs).toHaveLength(2);
    expect(docs[0]!.kind).toBe('AgentDefinition');
    expect(docs[1]!.kind).toBe('AgentDeployment');
  });

  it('parses YAML multi-doc', () => {
    const yaml = `
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDefinition
metadata:
  name: support-agent
spec:
  dna:
    format: hazeljs.agent.dna
    version: "1.0.0"
    name: support
    tools:
      - name: lookup_order
    exportedAt: "2026-01-01T00:00:00.000Z"
---
apiVersion: agent.hazeljs.dev/v1alpha1
kind: AgentDeployment
metadata:
  name: support
spec:
  definitionRef:
    name: support-agent
  runtimeClassName: local
`;
    const docs = parsePlatformDocuments(yaml);
    expect(docs.map((d) => d.kind)).toEqual(['AgentDefinition', 'AgentDeployment']);
  });

  it('rejects dna + packageRef together', () => {
    expect(() =>
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDefinition',
        metadata: { name: 'x' },
        spec: {
          dna: DNA,
          packageRef: { name: '@hazeljs/x', version: '1.0.0' },
        },
      })
    ).toThrow(PlatformValidationError);
  });

  it('rejects unknown kind', () => {
    expect(() =>
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentPod',
        metadata: { name: 'x' },
        spec: {},
      })
    ).toThrow(/Unknown kind/);
  });
});

describe('platform repository + reconciler', () => {
  it('applies definition + deployment to Ready and is idempotent on generation', async () => {
    const repo = new InMemoryResourceRepository();
    const backend = new LocalDeploymentBackend();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: backend },
    });

    const def = await reconciler.applyResource(parsePlatformResource(definitionDoc()));
    expect(def.ready).toBe(true);
    expect(def.resource.metadata.generation).toBe(1);

    const dep = await reconciler.applyResource(parsePlatformResource(deploymentDoc()));
    expect(dep.ready).toBe(true);
    expect(conditionOf(dep.resource.status, 'Ready')?.status).toBe('True');
    expect(dep.resource.metadata.generation).toBe(1);

    const again = await reconciler.applyResource(parsePlatformResource(deploymentDoc()));
    expect(again.resource.metadata.generation).toBe(1);

    const changed = await reconciler.applyResource(
      parsePlatformResource(
        deploymentDoc({
          spec: {
            definitionRef: { name: 'support-agent' },
            runtimeClassName: 'local',
            replicas: 1,
          },
        })
      )
    );
    expect(changed.resource.metadata.generation).toBe(2);
  });

  it('marks Degraded when definition is missing', async () => {
    const repo = new InMemoryResourceRepository();
    const backend = new LocalDeploymentBackend();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: backend },
    });
    const result = await reconciler.applyResource(parsePlatformResource(deploymentDoc()));
    expect(result.ready).toBe(false);
    expect(conditionOf(result.resource.status, 'Ready')?.status).toBe('False');
    expect(conditionOf(result.resource.status, 'Degraded')?.status).toBe('True');
  });

  it('reports unsupported kubernetes backend features', async () => {
    const repo = new InMemoryResourceRepository();
    const backend = new LocalDeploymentBackend();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: backend },
    });
    await reconciler.applyResource(parsePlatformResource(definitionDoc()));
    const result = await reconciler.applyResource(
      parsePlatformResource(
        deploymentDoc({
          spec: {
            definitionRef: { name: 'support-agent' },
            runtimeClassName: 'local',
            backend: { kubernetes: { nodeSelector: { gpu: 'true' } } },
          },
        })
      )
    );
    expect(result.ready).toBe(false);
    expect(result.message).toMatch(/kubernetes/i);
  });

  it('deletes deployment via backend cleanup', async () => {
    const repo = new InMemoryResourceRepository();
    const backend = new LocalDeploymentBackend();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: backend },
    });
    await reconciler.applyResource(parsePlatformResource(definitionDoc()));
    await reconciler.applyResource(parsePlatformResource(deploymentDoc()));
    const del = await reconciler.deleteResource({
      kind: 'AgentDeployment',
      name: 'support',
      namespace: 'default',
    });
    expect(del.deleted).toBe(true);
    expect(repo.get('AgentDeployment', 'support')).toBeUndefined();
    expect(await backend.observe({ name: 'support', namespace: 'default' })).toBeUndefined();
  });

  it('resolves packageRef through registry', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hazel-platform-'));
    try {
      const registry = new LocalFsAgentRegistry({ rootDir: path.join(tmp, 'registry') });
      const pkg = toMarketplacePackage(DNA);
      registry.publish(pkg);

      const platform = createLocalPlatform({
        storePath: path.join(tmp, 'resources.json'),
        registryRoot: registry.rootDir,
        projectRoot: path.join(tmp, 'empty-project'),
      });
      const result = await platform.reconciler.applyResource(
        parsePlatformResource({
          apiVersion: PLATFORM_API_VERSION,
          kind: 'AgentDefinition',
          metadata: { name: 'from-pkg' },
          spec: { packageRef: { name: pkg.name, version: pkg.version } },
        })
      );
      expect(result.ready).toBe(true);
      expect(result.resource.status?.backend?.packageSource).toBe('registry');
      expect(fs.existsSync(path.join(tmp, 'resources.json'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('links AgentRun to durable runId without duplicating checkpoints', async () => {
    const repo = new InMemoryResourceRepository();
    const reconciler = new PlatformReconciler(repo, {
      backends: { local: new LocalDeploymentBackend() },
      // no durable lookup — resource-only link
    });
    await reconciler.applyResource(parsePlatformResource(definitionDoc()));
    const result = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentRun',
        metadata: { name: 'run-1' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runId: 'exec_abc',
        },
      })
    );
    expect(result.ready).toBe(true);
    expect(result.resource.status?.backend?.runId).toBe('exec_abc');
    expect(String(result.resource.status?.backend?.note)).toMatch(/Checkpoints remain/);
  });
});
