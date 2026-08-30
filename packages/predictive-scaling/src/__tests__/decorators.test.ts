import 'reflect-metadata';
import { PredictiveScaling, ScalePredict, ScaleOnEvent, getPredictiveScaler } from '../decorators';
import { InMemoryScalingClient } from '../integrations/self-healing';
import { EventScalingRegistry } from '../events/event-scaling-registry';

describe('Predictive scaling decorators', () => {
  afterEach(() => {
    EventScalingRegistry.reset();
  });

  it('records metrics via @ScalePredict', async () => {
    const client = new InMemoryScalingClient();

    @PredictiveScaling({
      metrics: ['requests', 'latency'],
      hpa: { name: 'svc-hpa', namespace: 'default', client },
    })
    @ScaleOnEvent({ events: ['launch'], maxScale: 10 })
    class StreamingService {
      @ScalePredict({ triggers: ['viral-content'] })
      async streamVideo(): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'ok';
      }
    }

    const service = new StreamingService();
    await service.streamVideo();

    const scaler = getPredictiveScaler(StreamingService);
    expect(scaler).toBeDefined();
    expect(scaler!.getMetricsStore().getSamples('requests').length).toBeGreaterThan(0);
    expect(scaler!.getMetricsStore().getSamples('latency').length).toBeGreaterThan(0);
  });
});
