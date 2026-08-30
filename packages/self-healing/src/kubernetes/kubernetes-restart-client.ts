import { readFileSync } from 'node:fs';
import { KubernetesRestartClient } from '../types';

export interface KubernetesRestartClientOptions {
  apiServer?: string;
  token?: string;
  caCert?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Kubernetes rollout restart via Deployment annotation patch.
 * Works in-cluster (service account token) or with explicit API server + token.
 */
export class FetchKubernetesRestartClient implements KubernetesRestartClient {
  private readonly apiServer: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KubernetesRestartClientOptions = {}) {
    const host = process.env.KUBERNETES_SERVICE_HOST;
    const port = process.env.KUBERNETES_SERVICE_PORT ?? '443';
    const inCluster = host ? `https://${host}:${port}` : undefined;

    this.apiServer = (options.apiServer ?? inCluster ?? '').replace(/\/$/, '');
    this.token = options.token ?? this.readTokenFromFilesystem();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async rolloutRestart(deployment: string, namespace: string): Promise<void> {
    if (!this.apiServer) {
      throw new Error(
        'Kubernetes API server not configured. Set KUBERNETES_SERVICE_HOST or pass apiServer.'
      );
    }

    const patchBody = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
            },
          },
        },
      },
    };

    const url = `${this.apiServer}/apis/apps/v1/namespaces/${namespace}/deployments/${deployment}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/strategic-merge-patch+json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await this.fetchImpl(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchBody),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kubernetes rollout restart failed (${response.status}): ${body}`);
    }
  }

  private readTokenFromFilesystem(): string | undefined {
    try {
      return readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').trim();
    } catch {
      return process.env.KUBERNETES_TOKEN;
    }
  }
}

/**
 * In-memory client for tests and local simulations.
 */
export class InMemoryKubernetesRestartClient implements KubernetesRestartClient {
  readonly restarts: Array<{ deployment: string; namespace: string; at: number }> = [];

  async rolloutRestart(deployment: string, namespace: string): Promise<void> {
    this.restarts.push({ deployment, namespace, at: Date.now() });
  }
}
