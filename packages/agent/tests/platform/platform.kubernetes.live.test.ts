/**
 * Live Kubernetes cluster integration (opt-in).
 *
 * Skip by default so unit CI stays cluster-free.
 * Enable with: HAZEL_K8S_LIVE=1 (and a working kubectl / kind cluster).
 *
 * CI: hazeljs/.github/workflows/ci.yml job `k8s-platform-live`.
 */

import { spawnSync } from 'child_process';
import {
  PLATFORM_API_VERSION,
  PlatformReconciler,
  InMemoryResourceRepository,
  LocalDeploymentBackend,
  KubernetesDeploymentBackend,
  createKubectlKubernetesClient,
  isHazelK8sLiveEnabled,
  parsePlatformResource,
  exportAgentDna,
  conditionOf,
} from '../../src';

const live = isHazelK8sLiveEnabled();
const suite = live ? describe : describe.skip;

function kubectlOk(): boolean {
  const r = spawnSync('kubectl', ['cluster-info'], { encoding: 'utf8', timeout: 15_000 });
  return r.status === 0;
}

function ensureNamespace(ns: string): void {
  const get = spawnSync('kubectl', ['get', 'ns', ns], { encoding: 'utf8' });
  if (get.status === 0) return;
  const created = spawnSync('kubectl', ['create', 'ns', ns], { encoding: 'utf8' });
  if (created.status !== 0) {
    throw new Error(`Failed to create namespace ${ns}: ${created.stderr}`);
  }
}

suite('platform k8s live cluster', () => {
  const namespace = process.env.HAZEL_K8S_NAMESPACE?.trim() || 'hazel-platform-ci';
  const image = process.env.HAZEL_K8S_IMAGE?.trim() || 'registry.k8s.io/pause:3.9';
  const deployName = `hazel-live-${Date.now().toString(36)}`;

  beforeAll(() => {
    if (!kubectlOk()) {
      throw new Error(
        'HAZEL_K8S_LIVE=1 but kubectl cluster-info failed — start kind/minikube or set KUBECONFIG'
      );
    }
    ensureNamespace(namespace);
  });

  afterAll(() => {
    spawnSync(
      'kubectl',
      ['delete', 'deployment', deployName, '-n', namespace, '--ignore-not-found=true'],
      { encoding: 'utf8' }
    );
  });

  it('applies apps/v1 Deployment via kubectl client, observes, deletes', async () => {
    const client = createKubectlKubernetesClient({
      kubeconfig: process.env.KUBECONFIG,
    });
    const repo = new InMemoryResourceRepository();
    const k8s = new KubernetesDeploymentBackend({ client });
    const reconciler = new PlatformReconciler(repo, {
      backends: { kubernetes: k8s, k8s, local: new LocalDeploymentBackend() },
    });

    const dna = exportAgentDna({
      name: 'live-support',
      tools: [{ name: 'noop' }],
    });
    await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDefinition',
        metadata: { name: 'live-agent', namespace },
        spec: { dna },
      })
    );

    const applied = await reconciler.applyResource(
      parsePlatformResource({
        apiVersion: PLATFORM_API_VERSION,
        kind: 'AgentDeployment',
        metadata: { name: deployName, namespace },
        spec: {
          definitionRef: { name: 'live-agent', namespace },
          runtimeClassName: 'kubernetes',
          replicas: 1,
          backend: {
            kubernetes: {
              image,
              namespace,
              replicas: 1,
            },
          },
        },
      })
    );

    expect(applied.ready).toBe(true);
    expect(conditionOf(applied.resource.status, 'Ready')?.status).toBe('True');

    // Poll observe until readyReplicas or timeout (pause image is fast)
    let readyReplicas = 0;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const obs = await client.getDeployment(namespace, deployName);
      readyReplicas = obs?.readyReplicas ?? 0;
      if (readyReplicas >= 1) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    expect(readyReplicas).toBeGreaterThanOrEqual(1);

    const del = await reconciler.deleteResource({
      kind: 'AgentDeployment',
      name: deployName,
      namespace,
    });
    expect(del.deleted).toBe(true);

    // Eventually gone
    let gone = false;
    const goneDeadline = Date.now() + 30_000;
    while (Date.now() < goneDeadline) {
      const obs = await client.getDeployment(namespace, deployName);
      if (!obs || obs.exists === false) {
        gone = true;
        break;
      }
      // kubectl get may still return terminating object briefly
      await new Promise((r) => setTimeout(r, 1500));
      const check = spawnSync('kubectl', ['get', 'deployment', deployName, '-n', namespace], {
        encoding: 'utf8',
      });
      if (check.status !== 0) {
        gone = true;
        break;
      }
    }
    expect(gone).toBe(true);
  }, 120_000);
});
