import {
  createPredictiveScaler,
  createAIForecastProvider,
  adaptSelfHealingScalingClient,
  parseDuration,
  decideScaling,
  InMemoryScalingClient,
} from '../index';

describe('package exports', () => {
  it('exposes public API', () => {
    expect(parseDuration('15m')).toBe(900_000);
    expect(createPredictiveScaler).toBeDefined();
    expect(createAIForecastProvider).toBeDefined();
    expect(adaptSelfHealingScalingClient).toBeDefined();

    const client = new InMemoryScalingClient();
    const adapted = adaptSelfHealingScalingClient(client);
    expect(adapted.getHpaMinReplicas).toBeDefined();

    const decision = decideScaling({
      currentReplicas: 1,
      predictedLoad: 10,
      capacityPerReplica: 100,
      maxReplicas: 5,
      minReplicas: 1,
      confidence: 0.9,
    });
    expect(decision.action).toBe('hold');
  });
});
