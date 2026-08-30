import { createPrometheusMetricsCollector } from '../metrics/prometheus-collector';
import { attachPrometheusCollector } from '../integrations/prometheus';
import { createPredictiveScaler } from '../scaling/predictive-scaler';
import { InMemoryScalingClient } from '../integrations/self-healing';

describe('Prometheus metrics collector', () => {
  it('queries Prometheus and emits samples', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { result: [{ value: [1_700_000_000, '42.5'] }] },
      }),
    });

    const samples: number[] = [];
    const collector = createPrometheusMetricsCollector(
      {
        baseUrl: 'http://prometheus:9090',
        queries: { requests: 'sum(rate(http_requests_total[5m]))' },
        fetchImpl,
      },
      (sample) => samples.push(sample.value)
    );

    await collector.pollOnce();

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/query?query='),
      expect.any(Object)
    );
    expect(samples).toEqual([42.5]);
  });

  it('feeds predictive scaler via attachPrometheusCollector', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { result: [{ value: [1_700_000_000, '100'] }] },
      }),
    });

    const client = new InMemoryScalingClient();
    const scaler = createPredictiveScaler({
      metrics: ['requests'],
      hpa: { name: 'api-hpa', client },
    });

    const collector = attachPrometheusCollector(scaler, {
      baseUrl: 'http://prometheus:9090',
      queries: { requests: 'sum(rate(http_requests_total[5m]))' },
      fetchImpl,
    });

    await collector.pollOnce();

    expect(scaler.getMetricsStore().getLatest('requests')?.value).toBe(100);
  });
});
