import { KubernetesScalingClient } from '../types';

export interface KubernetesScalingClientOptions {
  apiServer?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Patch HorizontalPodAutoscaler min replicas via Kubernetes API.
 */
export class FetchKubernetesScalingClient implements KubernetesScalingClient {
  private readonly apiServer: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: KubernetesScalingClientOptions = {}) {
    const host = process.env.KUBERNETES_SERVICE_HOST;
    const port = process.env.KUBERNETES_SERVICE_PORT ?? '443';
    const inCluster = host ? `https://${host}:${port}` : undefined;

    this.apiServer = (options.apiServer ?? inCluster ?? '').replace(/\/$/, '');
    this.token = options.token ?? process.env.KUBERNETES_TOKEN;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getHpaMinReplicas(hpa: string, namespace: string): Promise<number> {
    const hpaBody = await this.readHpa(hpa, namespace);
    return hpaBody.spec?.minReplicas ?? 1;
  }

  async setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void> {
    const url = `${this.apiServer}/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${hpa}`;
    const response = await this.fetchImpl(url, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({
        spec: { minReplicas },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HPA patch failed (${response.status}): ${body}`);
    }
  }

  private async readHpa(
    hpa: string,
    namespace: string
  ): Promise<{ spec?: { minReplicas?: number } }> {
    const url = `${this.apiServer}/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${hpa}`;
    const response = await this.fetchImpl(url, { headers: this.headers() });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HPA read failed (${response.status}): ${body}`);
    }

    return (await response.json()) as { spec?: { minReplicas?: number } };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/strategic-merge-patch+json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }
}

export class InMemoryKubernetesScalingClient implements KubernetesScalingClient {
  readonly updates: Array<{ hpa: string; namespace: string; minReplicas: number; at: number }> = [];
  private readonly state = new Map<string, number>();

  async getHpaMinReplicas(hpa: string, namespace: string): Promise<number> {
    return this.state.get(this.key(hpa, namespace)) ?? 1;
  }

  async setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void> {
    this.state.set(this.key(hpa, namespace), minReplicas);
    this.updates.push({ hpa, namespace, minReplicas, at: Date.now() });
  }

  private key(hpa: string, namespace: string): string {
    return `${namespace}/${hpa}`;
  }
}
