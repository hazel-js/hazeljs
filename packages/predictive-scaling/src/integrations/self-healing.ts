import { KubernetesScalingClient } from '../types';

type SelfHealingScalingClient = {
  getHpaMinReplicas(hpa: string, namespace: string): Promise<number>;
  setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void>;
};

/**
 * Bridge scaling clients exported by @hazeljs/self-healing.
 */
export function adaptSelfHealingScalingClient(
  client: SelfHealingScalingClient
): KubernetesScalingClient {
  return {
    getHpaMinReplicas: (hpa, namespace) => client.getHpaMinReplicas(hpa, namespace),
    setHpaMinReplicas: (hpa, namespace, minReplicas) =>
      client.setHpaMinReplicas(hpa, namespace, minReplicas),
  };
}

export class InMemoryScalingClient implements KubernetesScalingClient {
  readonly updates: Array<{ hpa: string; namespace: string; minReplicas: number }> = [];
  private readonly state = new Map<string, number>();

  async getHpaMinReplicas(hpa: string, namespace: string): Promise<number> {
    return this.state.get(`${namespace}/${hpa}`) ?? 2;
  }

  async setHpaMinReplicas(hpa: string, namespace: string, minReplicas: number): Promise<void> {
    this.state.set(`${namespace}/${hpa}`, minReplicas);
    this.updates.push({ hpa, namespace, minReplicas });
  }
}
