import { TelemetryService, createPrometheusExporter } from './telemetry';

describe('TelemetryService', () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    TelemetryService.reset();
    telemetry = TelemetryService.getInstance({ serviceName: 'test-pipeline' });
    telemetry.clear();
  });

  it('records span', async () => {
    await telemetry.recordSpan({
      traceId: 't1',
      spanId: 's1',
      pipeline: 'orders',
      step: 1,
      stepName: 'validate',
      startTime: 0,
      endTime: 100,
      durationMs: 100,
      status: 'ok',
      attributes: {},
    });
    const spans = telemetry.getSpans('orders');
    expect(spans).toHaveLength(1);
    expect(spans[0].durationMs).toBe(100);
  });

  it('records metric', async () => {
    await telemetry.recordMetric('test.metric', 42, { env: 'test' });
    const metrics = telemetry.getMetrics('test.metric');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(42);
  });

  it('records step metrics', async () => {
    await telemetry.recordStepMetrics('orders', 'validate', 50, true, 10);
    const metrics = telemetry.getMetrics('hazel.pipeline.step.duration_ms');
    expect(metrics.length).toBeGreaterThanOrEqual(1);
  });

  it('getSummary returns pipeline stats', () => {
    telemetry.getSpans(); // ensure we have data structure
    const summary = telemetry.getSummary('orders');
    expect(summary).toHaveProperty('totalRuns');
    expect(summary).toHaveProperty('successRate');
  });

  it('createPrometheusExporter returns exporter and getText', () => {
    const { exporter, getText } = createPrometheusExporter();
    exporter({ name: 'test', value: 1, labels: {}, timestamp: Date.now() });
    const text = getText();
    expect(text).toContain('test');
  });
});
