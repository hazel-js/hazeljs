/**
 * In-memory + request-based + kubectl-based Kubernetes workload clients.
 */

import { spawn } from 'child_process';
import type { KubernetesWorkloadClient, KubernetesWorkloadObservation } from './kubernetes-types';

function observationFromManifest(
  manifest: Record<string, unknown>,
  exists = true
): KubernetesWorkloadObservation {
  const metadata = (manifest.metadata ?? {}) as Record<string, unknown>;
  const spec = (manifest.spec ?? {}) as Record<string, unknown>;
  const status = (manifest.status ?? {}) as Record<string, unknown>;
  const name = String(metadata.name ?? '');
  const namespace = String(metadata.namespace ?? 'default');
  const replicas = typeof spec.replicas === 'number' ? spec.replicas : 1;
  const readyReplicas = typeof status.readyReplicas === 'number' ? status.readyReplicas : replicas;
  const template = (spec.template ?? {}) as Record<string, unknown>;
  const podSpec = (template.spec ?? {}) as Record<string, unknown>;
  const containers = Array.isArray(podSpec.containers)
    ? (podSpec.containers as Array<{ image?: string }>)
    : [];

  return {
    name,
    namespace,
    uid: typeof metadata.uid === 'string' ? metadata.uid : `uid-${namespace}-${name}`,
    replicas,
    readyReplicas,
    availableReplicas: readyReplicas,
    updatedReplicas: readyReplicas,
    generation: typeof metadata.generation === 'number' ? metadata.generation : 1,
    observedGeneration:
      typeof status.observedGeneration === 'number' ? status.observedGeneration : 1,
    conditions: [
      {
        type: 'Available',
        status: readyReplicas >= replicas ? 'True' : 'False',
        reason: 'InMemorySpike',
        message: 'In-memory Kubernetes client observation',
      },
    ],
    images: containers.map((c) => c.image).filter((v): v is string => !!v),
    exists,
  };
}

/** Test / dry-cluster double — no network. */
export class InMemoryKubernetesWorkloadClient implements KubernetesWorkloadClient {
  private readonly store = new Map<string, Record<string, unknown>>();

  private key(namespace: string, name: string): string {
    return `${namespace}/${name}`;
  }

  async applyDeployment(manifest: Record<string, unknown>): Promise<KubernetesWorkloadObservation> {
    const metadata = (manifest.metadata ?? {}) as Record<string, unknown>;
    const name = String(metadata.name ?? '');
    const namespace = String(metadata.namespace ?? 'default');
    const existing = this.store.get(this.key(namespace, name));
    const next = {
      ...manifest,
      metadata: {
        ...metadata,
        uid:
          (existing?.metadata as { uid?: string } | undefined)?.uid ?? `uid-${namespace}-${name}`,
        generation: existing
          ? Number((existing.metadata as { generation?: number }).generation ?? 1) + 1
          : 1,
      },
      status: {
        readyReplicas: (manifest.spec as { replicas?: number })?.replicas ?? 1,
        availableReplicas: (manifest.spec as { replicas?: number })?.replicas ?? 1,
        updatedReplicas: (manifest.spec as { replicas?: number })?.replicas ?? 1,
        observedGeneration: existing
          ? Number((existing.metadata as { generation?: number }).generation ?? 1) + 1
          : 1,
      },
    };
    this.store.set(this.key(namespace, name), next);
    return observationFromManifest(next);
  }

  async getDeployment(
    namespace: string,
    name: string
  ): Promise<KubernetesWorkloadObservation | undefined> {
    const found = this.store.get(this.key(namespace, name));
    return found ? observationFromManifest(found) : undefined;
  }

  async deleteDeployment(namespace: string, name: string): Promise<{ deleted: boolean }> {
    return { deleted: this.store.delete(this.key(namespace, name)) };
  }

  clear(): void {
    this.store.clear();
  }

  list(): string[] {
    return [...this.store.keys()];
  }
}

export interface KubernetesRequestFn {
  (input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    contentType?: string;
  }): Promise<{ data: unknown; status: number }>;
}

/**
 * Adapter over a generic REST request function (e.g. wrap @hazeljs/kubernetes
 * KubernetesRestClient.request). No hard dependency on the kubernetes package.
 */
export function createRequestBasedKubernetesClient(
  request: KubernetesRequestFn
): KubernetesWorkloadClient {
  return {
    async applyDeployment(manifest) {
      const metadata = (manifest.metadata ?? {}) as Record<string, unknown>;
      const name = String(metadata.name ?? '');
      const namespace = String(metadata.namespace ?? 'default');
      const path = `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`;
      try {
        const existing = await request({ method: 'GET', path });
        if (existing.status >= 200 && existing.status < 300) {
          const patched = await request({
            method: 'PUT',
            path,
            body: manifest,
            contentType: 'application/json',
          });
          return toObservation(patched.data, true);
        }
      } catch {
        /* create below */
      }
      const created = await request({
        method: 'POST',
        path: `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments`,
        body: manifest,
        contentType: 'application/json',
      });
      return toObservation(created.data, true);
    },

    async getDeployment(namespace, name) {
      try {
        const result = await request({
          method: 'GET',
          path: `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
        });
        if (result.status === 404) return undefined;
        return toObservation(result.data, true);
      } catch {
        return undefined;
      }
    },

    async deleteDeployment(namespace, name) {
      try {
        const result = await request({
          method: 'DELETE',
          path: `/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}`,
        });
        return { deleted: result.status >= 200 && result.status < 300 };
      } catch {
        return { deleted: false };
      }
    },
  };
}

export interface KubectlKubernetesClientOptions {
  /** kubectl binary (default: kubectl) */
  kubectl?: string;
  /** kubeconfig path (sets --kubeconfig) */
  kubeconfig?: string;
  /** kubectl context */
  context?: string;
}

function runKubectl(
  opts: KubectlKubernetesClientOptions,
  args: string[],
  stdin?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const bin = opts.kubectl ?? 'kubectl';
  const full = [
    ...(opts.kubeconfig ? ['--kubeconfig', opts.kubeconfig] : []),
    ...(opts.context ? ['--context', opts.context] : []),
    ...args,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, full, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    if (stdin != null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

/**
 * Live-cluster client via `kubectl` (kind / minikube / real kubeconfig).
 * Used by HAZEL_K8S_LIVE integration tests — no hard dep on client-node.
 */
export function createKubectlKubernetesClient(
  options: KubectlKubernetesClientOptions = {}
): KubernetesWorkloadClient {
  return {
    async applyDeployment(manifest) {
      const result = await runKubectl(
        options,
        ['apply', '-f', '-', '-o', 'json'],
        JSON.stringify(manifest)
      );
      if (result.code !== 0) {
        throw new Error(`kubectl apply failed: ${result.stderr || result.stdout}`);
      }
      return toObservation(JSON.parse(result.stdout) as unknown, true);
    },

    async getDeployment(namespace, name) {
      const result = await runKubectl(options, [
        'get',
        'deployment',
        name,
        '-n',
        namespace,
        '-o',
        'json',
      ]);
      if (result.code !== 0) {
        if (/NotFound|not found/i.test(result.stderr + result.stdout)) return undefined;
        throw new Error(`kubectl get failed: ${result.stderr || result.stdout}`);
      }
      return toObservation(JSON.parse(result.stdout) as unknown, true);
    },

    async deleteDeployment(namespace, name) {
      const result = await runKubectl(options, [
        'delete',
        'deployment',
        name,
        '-n',
        namespace,
        '--ignore-not-found=true',
        '-o',
        'name',
      ]);
      if (result.code !== 0) {
        throw new Error(`kubectl delete failed: ${result.stderr || result.stdout}`);
      }
      return { deleted: result.stdout.trim().length > 0 };
    },
  };
}

/** True when live K8s integration should run (opt-in; default skip). */
export function isHazelK8sLiveEnabled(): boolean {
  const v = process.env.HAZEL_K8S_LIVE?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function toObservation(data: unknown, exists: boolean): KubernetesWorkloadObservation {
  if (!data || typeof data !== 'object') {
    return {
      name: '',
      namespace: 'default',
      exists,
    };
  }
  return observationFromManifest(data as Record<string, unknown>, exists);
}
