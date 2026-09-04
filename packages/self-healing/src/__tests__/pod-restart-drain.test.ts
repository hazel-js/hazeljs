import { HealingCoordinator } from '../healing/healing-coordinator';
import { InMemoryKubernetesRestartClient } from '../index';

describe('Pod restart with graceful drain', () => {
  it('drains before rollout restart', async () => {
    const client = new InMemoryKubernetesRestartClient();

    let inflight = 1;
    setTimeout(() => {
      inflight = 0;
    }, 40);

    const coordinator = new HealingCoordinator({
      drain: {
        timeoutMs: 1000,
        pollIntervalMs: 20,
        getInflightCount: () => inflight,
      },
      strategies: ['pod-restart'],
      kubernetes: {
        deployment: 'orders-api',
        namespace: 'prod',
        client,
        drainBeforeRestart: true,
      },
    });

    const result = await coordinator.heal(
      'OrderService.create',
      Object.assign(new Error('pod crash'), { code: 'ECONNREFUSED' }),
      { maxAttempts: 1, strategies: ['pod-restart'] }
    );

    expect(result.recovered).toBe(true);
    expect(client.restarts).toHaveLength(1);
  });
});
