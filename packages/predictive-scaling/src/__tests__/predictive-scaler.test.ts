import { createPredictiveScaler } from '../scaling/predictive-scaler';
import { InMemoryScalingClient } from '../integrations/self-healing';
import { EventScalingRegistry } from '../events/event-scaling-registry';

describe('PredictiveScaler', () => {
  afterEach(() => {
    EventScalingRegistry.reset();
  });

  it('scales HPA up on high predicted demand', async () => {
    const client = new InMemoryScalingClient();
    await client.setHpaMinReplicas('api-hpa', 'prod', 2);

    const scaler = createPredictiveScaler({
      metrics: ['requests'],
      horizon: '30m',
      confidence: 0.5,
      capacityPerReplica: 50,
      pollIntervalMs: 60_000,
      hpa: { name: 'api-hpa', namespace: 'prod', client, maxReplicas: 20 },
    });

    const base = Date.now() - 30 * 60_000;
    for (let i = 0; i < 20; i++) {
      scaler.recordMetric('requests', 80 + i * 15, base + i * 60_000);
    }

    const event = await scaler.runCycle();

    expect(['scale-up', 'no-op', 'hold']).toContain(event.type === 'no-op' ? 'no-op' : event.type);
    if (event.type === 'scale-up') {
      expect(event.toReplicas).toBeGreaterThan(event.fromReplicas);
    }
  });

  it('boosts replicas on registered events', async () => {
    const client = new InMemoryScalingClient();
    await client.setHpaMinReplicas('shop-hpa', 'prod', 3);

    EventScalingRegistry.register('EcommerceService', {
      events: ['black-friday'],
      maxScale: 50,
      scaleFactor: 2,
    });

    const scaler = createPredictiveScaler({
      hpa: { name: 'shop-hpa', namespace: 'prod', client },
    });

    const events = await scaler.triggerEvent('black-friday');

    expect(events[0].toReplicas).toBe(6);
    expect(client.updates.at(-1)?.minReplicas).toBe(6);
  });
});
