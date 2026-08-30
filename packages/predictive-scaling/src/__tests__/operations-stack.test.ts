import { createOperationsStack } from '../integrations/operations-stack';
import { InMemoryScalingClient } from '../integrations/self-healing';

describe('createOperationsStack', () => {
  it('wires healing and predictive scaler with shared scaling client', () => {
    const client = new InMemoryScalingClient();

    const stack = createOperationsStack({
      healing: {
        strategies: ['hpa-boost', 'pod-restart'],
        kubernetes: {
          deployment: 'orders-api',
          namespace: 'prod',
          hpa: { name: 'orders-hpa', client, boostMinReplicas: 4 },
        },
      },
      scaling: {
        metrics: ['requests'],
        hpa: { name: 'orders-hpa', namespace: 'prod', client },
      },
    });

    expect(stack.healing).toBeDefined();
    expect(stack.scaler).toBeDefined();
    expect(stack.prometheus).toBeUndefined();

    stack.start();
    stack.stop();
  });

  it('throws when no scaling client is provided', () => {
    expect(() =>
      createOperationsStack({
        scaling: {
          hpa: { name: 'missing-client-hpa' } as never,
        },
      })
    ).toThrow(/requires scaling\.hpa\.client/);
  });
});
