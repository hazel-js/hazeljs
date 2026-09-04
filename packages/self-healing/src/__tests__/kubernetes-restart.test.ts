import { HealingCoordinator } from '../healing/healing-coordinator';
import {
  FetchKubernetesRestartClient,
  InMemoryKubernetesRestartClient,
} from '../kubernetes/kubernetes-restart-client';

describe('Kubernetes pod restart', () => {
  it('records rollout restart in memory client', async () => {
    const client = new InMemoryKubernetesRestartClient();
    const coordinator = new HealingCoordinator({
      strategies: ['pod-restart'],
      kubernetes: {
        deployment: 'payments-api',
        namespace: 'prod',
        client,
      },
    });

    const result = await coordinator.heal(
      'PaymentService.charge',
      Object.assign(new Error('pod unhealthy'), { code: 'ECONNREFUSED' }),
      { maxAttempts: 1, strategies: ['pod-restart'] }
    );

    expect(result.recovered).toBe(true);
    expect(client.restarts).toEqual([
      expect.objectContaining({ deployment: 'payments-api', namespace: 'prod' }),
    ]);
  });

  it('patches deployment via fetch client', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
    const client = new FetchKubernetesRestartClient({
      apiServer: 'https://k8s.example.com',
      token: 'test-token',
      fetchImpl,
    });

    await client.rolloutRestart('orders-api', 'staging');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://k8s.example.com/apis/apps/v1/namespaces/staging/deployments/orders-api',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });
});
