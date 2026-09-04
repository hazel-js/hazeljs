import { decideScaling } from '../scaling/replica-calculator';

describe('Replica calculator', () => {
  it('scales up when predicted load exceeds headroom', () => {
    const decision = decideScaling(
      {
        currentReplicas: 2,
        predictedLoad: 500,
        capacityPerReplica: 100,
        maxReplicas: 20,
        minReplicas: 1,
        confidence: 0.9,
      },
      { enabled: true, minConfidence: 0.7 }
    );

    expect(decision.action).toBe('scale-up');
    expect(decision.targetReplicas).toBeGreaterThan(2);
  });

  it('holds when confidence is low', () => {
    const decision = decideScaling(
      {
        currentReplicas: 2,
        predictedLoad: 500,
        capacityPerReplica: 100,
        maxReplicas: 20,
        minReplicas: 1,
        confidence: 0.4,
      },
      { enabled: true, minConfidence: 0.7 }
    );

    expect(decision.action).toBe('hold');
  });
});
