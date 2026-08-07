import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  KubernetesDeploymentBackend,
  InMemoryKubernetesWorkloadClient,
  buildKubernetesDeploymentManifest,
  parsePlatformResource,
  createLocalPlatform,
  conditionOf,
  exportAgentDna,
  HAZEL_K8S_LABEL_MANAGED,
} from '../../src';

const DNA = exportAgentDna({
  name: 'support',
  tools: [{ name: 'lookup_order' }],
});

function definition() {
  return parsePlatformResource({
    apiVersion: PLATFORM_API_VERSION,
    kind: 'AgentDefinition',
    metadata: { name: 'support-agent' },
    spec: { dna: DNA },
  });
}

describe('platform phase 4 — kubernetes backend spike', () => {
  it('builds apps/v1 Deployment with Hazel labels (no CRD)', () => {
    const repo = new InMemoryResourceRepository();
    const def = repo.upsert(definition());
    const dep = repo.upsert(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: 'support' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runtimeClassName: 'kubernetes',
          replicas: 2,
          backend: {
            kubernetes: {
              image: 'ghcr.io/hazel-js/support-agent:1.0.0',
              namespace: 'agents',
              nodeSelector: { workload: 'agents' },
            },
          },
        },
      })
    );

    // resolve manually for manifest builder
    const built = buildKubernetesDeploymentManifest({
      deployment: dep as never,
      definition: {
        definition: def as never,
        dna: DNA,
        source: 'nested',
      },
      runtimeClassName: 'kubernetes',
    });

    expect(built.manifest.apiVersion).toBe('apps/v1');
    expect(built.manifest.kind).toBe('Deployment');
    expect(built.namespace).toBe('agents');
    expect(built.replicas).toBe(2);
    const meta = built.manifest.metadata as { labels: Record<string, string> };
    expect(meta.labels[HAZEL_K8S_LABEL_MANAGED]).toBe('true');
    const spec = built.manifest.spec as {
      template: {
        spec: { nodeSelector?: Record<string, string>; containers: Array<{ image: string }> };
      };
    };
    expect(spec.template.spec.nodeSelector?.workload).toBe('agents');
    expect(spec.template.spec.containers[0]!.image).toBe('ghcr.io/hazel-js/support-agent:1.0.0');
    // Core schema must not require kubernetes fields — they live under backend.kubernetes
    expect(JSON.stringify(built.manifest)).not.toMatch(/AgentDefinition/);
  });

  it('dryRun plans manifest without a cluster client', async () => {
    const repo = new InMemoryResourceRepository();
    const backend = new KubernetesDeploymentBackend({ forceDryRun: true });
    const reconciler = new PlatformReconciler(repo, {
      backends: { kubernetes: backend, k8s: backend, local: new LocalDeploymentBackend() },
    });
    await reconciler.applyResource(definition());
    const result = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: 'support' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runtimeClassName: 'kubernetes',
          backend: { kubernetes: { dryRun: true, image: 'app:1' } },
        },
      })
    );
    expect(result.ready).toBe(true);
    expect(result.resource.status?.backend?.dryRun).toBe(true);
    expect(result.resource.status?.backend?.kind).toBe('Deployment');
    expect(conditionOf(result.resource.status, 'Ready')?.status).toBe('True');
  });

  it('applies via InMemoryKubernetesWorkloadClient and deletes', async () => {
    const client = new InMemoryKubernetesWorkloadClient();
    const repo = new InMemoryResourceRepository();
    const k8s = new KubernetesDeploymentBackend({ client });
    const reconciler = new PlatformReconciler(repo, {
      backends: { kubernetes: k8s, local: new LocalDeploymentBackend() },
    });
    await reconciler.applyResource(definition());
    const applied = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: 'support', namespace: 'default' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runtimeClassName: 'kubernetes',
          backend: {
            kubernetes: {
              image: 'ghcr.io/example/agent:1',
              replicas: 1,
            },
          },
        },
      })
    );
    expect(applied.ready).toBe(true);
    expect(applied.resource.status?.backend?.readyReplicas).toBe(1);
    expect(client.list()).toContain('default/support');

    const del = await reconciler.deleteResource({
      kind: 'AgentDeployment',
      name: 'support',
      namespace: 'default',
    });
    expect(del.deleted).toBe(true);
    expect(client.list()).not.toContain('default/support');
  });

  it('fails honestly without image when not dryRun', async () => {
    const client = new InMemoryKubernetesWorkloadClient();
    const repo = new InMemoryResourceRepository();
    const k8s = new KubernetesDeploymentBackend({ client });
    const reconciler = new PlatformReconciler(repo, {
      backends: { kubernetes: k8s },
    });
    await reconciler.applyResource(definition());
    const result = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: 'support' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runtimeClassName: 'kubernetes',
          backend: { kubernetes: {} },
        },
      })
    );
    expect(result.ready).toBe(false);
    expect(result.message).toMatch(/image/);
  });

  it('createLocalPlatform registers kubernetes when enabled', async () => {
    const client = new InMemoryKubernetesWorkloadClient();
    const platform = createLocalPlatform({
      kubernetes: { client },
      events: false,
      admission: false,
    });
    expect(platform.kubernetesBackend).toBeDefined();
    await platform.reconciler.applyResource(definition());
    const result = await platform.reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: 'support' },
        spec: {
          definitionRef: { name: 'support-agent' },
          runtimeClassName: 'k8s',
          backend: { kubernetes: { image: 'app:dev' } },
        },
      })
    );
    expect(result.ready).toBe(true);
  });
});
