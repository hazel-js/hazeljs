import { HealingCoordinator } from '../healing/healing-coordinator';
import { InMemoryKubernetesRestartClient, InMemoryKubernetesScalingClient } from '../index';

describe('HPA boost strategy', () => {
  it('boosts min replicas and schedules restore', async () => {
    jest.useFakeTimers();
    const scaling = new InMemoryKubernetesScalingClient();
    await scaling.setHpaMinReplicas('payments-hpa', 'prod', 1);

    const coordinator = new HealingCoordinator({
      strategies: ['hpa-boost'],
      kubernetes: {
        deployment: 'payments-api',
        namespace: 'prod',
        client: new InMemoryKubernetesRestartClient(),
        hpa: {
          name: 'payments-hpa',
          namespace: 'prod',
          client: scaling,
          boostMinReplicas: 4,
          restoreAfterMs: 1000,
        },
      },
    });

    const result = await coordinator.heal('PaymentService.charge', new Error('latency spike'), {
      maxAttempts: 1,
      strategies: ['hpa-boost'],
    });

    expect(result.recovered).toBe(true);
    expect(await scaling.getHpaMinReplicas('payments-hpa', 'prod')).toBe(4);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(await scaling.getHpaMinReplicas('payments-hpa', 'prod')).toBe(1);
    jest.useRealTimers();
  });
});

describe('Performance-driven auto scale', () => {
  it('triggers hpa-boost on critical latency', async () => {
    const scaling = new InMemoryKubernetesScalingClient();

    const coordinator = new HealingCoordinator({
      performance: {
        enabled: true,
        autoScaleOnDegradation: true,
        thresholds: { criticalLatencyMs: 100, sampleSize: 3 },
      },
      strategies: ['hpa-boost'],
      kubernetes: {
        deployment: 'api',
        hpa: {
          name: 'api-hpa',
          client: scaling,
          boostMinReplicas: 3,
          restoreAfterMs: 60000,
        },
      },
    });

    await coordinator.recordLatency('Api.handler', 150);
    await coordinator.recordLatency('Api.handler', 160);
    await coordinator.recordLatency('Api.handler', 170);

    expect(scaling.updates.some((update) => update.minReplicas === 3)).toBe(true);
  });
});
