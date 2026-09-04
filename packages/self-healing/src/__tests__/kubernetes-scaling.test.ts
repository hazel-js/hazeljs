import {
  FetchKubernetesScalingClient,
  InMemoryKubernetesScalingClient,
} from '../kubernetes/kubernetes-scaling-client';

describe('Kubernetes scaling client', () => {
  it('updates min replicas in memory', async () => {
    const client = new InMemoryKubernetesScalingClient();
    await client.setHpaMinReplicas('web-hpa', 'default', 3);
    expect(await client.getHpaMinReplicas('web-hpa', 'default')).toBe(3);
  });

  it('patches HPA via fetch', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ spec: { minReplicas: 2 } }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => '' });

    const client = new FetchKubernetesScalingClient({
      apiServer: 'https://k8s.example.com',
      token: 'token',
      fetchImpl,
    });

    await client.setHpaMinReplicas('web-hpa', 'prod', 5);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('horizontalpodautoscalers/web-hpa');
  });
});
