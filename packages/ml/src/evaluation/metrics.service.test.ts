import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records and retrieves evaluation', () => {
    service.recordEvaluation({
      modelName: 'model',
      version: '1.0.0',
      metrics: { accuracy: 0.95, loss: 0.05 },
      evaluatedAt: new Date(),
    });
    const metrics = service.getMetrics('model', '1.0.0');
    expect(metrics?.metrics.accuracy).toBe(0.95);
  });

  it('getMetrics returns latest when no version', () => {
    service.recordEvaluation({
      modelName: 'm',
      version: '1',
      metrics: { accuracy: 0.9 },
      evaluatedAt: new Date(),
    });
    service.recordEvaluation({
      modelName: 'm',
      version: '2',
      metrics: { accuracy: 0.95 },
      evaluatedAt: new Date(),
    });
    const latest = service.getMetrics('m');
    expect(latest?.version).toBe('2');
    expect(latest?.metrics.accuracy).toBe(0.95);
  });

  it('getHistory returns all evaluations', () => {
    service.recordEvaluation({
      modelName: 'm',
      version: '1',
      metrics: {},
      evaluatedAt: new Date(),
    });
    service.recordEvaluation({
      modelName: 'm',
      version: '2',
      metrics: {},
      evaluatedAt: new Date(),
    });
    expect(service.getHistory('m')).toHaveLength(2);
  });

  it('compareVersions returns winner by accuracy', () => {
    service.recordEvaluation({
      modelName: 'm',
      version: 'a',
      metrics: { accuracy: 0.9 },
      evaluatedAt: new Date(),
    });
    service.recordEvaluation({
      modelName: 'm',
      version: 'b',
      metrics: { accuracy: 0.95 },
      evaluatedAt: new Date(),
    });
    const { a, b, winner } = service.compareVersions('m', 'a', 'b');
    expect(a?.metrics.accuracy).toBe(0.9);
    expect(b?.metrics.accuracy).toBe(0.95);
    expect(winner).toBe('b');
  });

  it('compareVersions when no accuracy', () => {
    service.recordEvaluation({
      modelName: 'm',
      version: 'a',
      metrics: {},
      evaluatedAt: new Date(),
    });
    const { winner } = service.compareVersions('m', 'a', 'b');
    expect(winner).toBeUndefined();
  });
});
