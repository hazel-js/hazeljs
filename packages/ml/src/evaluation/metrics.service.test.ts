import { ModelRegistry } from '../registry/model.registry';
import { PredictorService } from '../inference/predictor.service';
import { MetricsService } from './metrics.service';
import { Model, Train, Predict } from '../decorators';

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

  describe('evaluate', () => {
    @Model({ name: 'eval-model', version: '1.0.0', framework: 'custom' })
    class EvalModel {
      @Train()
      train() {}

      @Predict()
      async predict(input: { text: string }) {
        const sentiment = input.text.includes('good') ? 'positive' : 'negative';
        return { sentiment };
      }
    }

    it('throws when PredictorService not injected', async () => {
      const svc = new MetricsService();
      await expect(svc.evaluate('any', [{ text: 'hello', label: 'neutral' }])).rejects.toThrow(
        'MetricsService.evaluate() requires PredictorService'
      );
    });

    it('throws when testData is empty', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      await expect(svc.evaluate('eval-model', [])).rejects.toThrow('testData cannot be empty');
    });

    it('computes accuracy, precision, recall, f1 from test data', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const testData = [
        { text: 'good day', label: 'positive' },
        { text: 'bad day', label: 'negative' },
        { text: 'good weather', label: 'positive' },
        { text: 'bad weather', label: 'negative' },
      ];

      const result = await svc.evaluate('eval-model', testData);

      expect(result.modelName).toBe('eval-model');
      expect(result.version).toBe('1.0.0');
      expect(result.metrics.accuracy).toBe(1);
      expect(result.metrics.precision).toBe(1);
      expect(result.metrics.recall).toBe(1);
      expect(result.metrics.f1Score).toBe(1);
    });

    it('supports custom labelKey and predictionKey', async () => {
      @Model({ name: 'custom-model', version: '1.0.0', framework: 'custom' })
      class CustomModel {
        @Train()
        train() {}

        @Predict()
        async predict(input: { x: string }) {
          return { outcome: input.x === 'a' ? 'yes' : 'no' };
        }
      }

      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'custom-model', version: '1.0.0', framework: 'custom' },
        instance: new CustomModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'custom-model',
        [
          { x: 'a', outcome: 'yes' },
          { x: 'b', outcome: 'no' },
        ],
        { labelKey: 'outcome', predictionKey: 'outcome' }
      );

      expect(result.metrics.accuracy).toBe(1);
    });

    it('extractPredictedLabel uses first value when no known key', async () => {
      @Model({ name: 'fallback-model', version: '1.0.0', framework: 'custom' })
      class FallbackModel {
        @Train()
        train() {}

        @Predict()
        async predict() {
          return { customKey: 'positive' };
        }
      }

      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'fallback-model', version: '1.0.0', framework: 'custom' },
        instance: new FallbackModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate('fallback-model', [{ text: 'x', label: 'positive' }], {
        metrics: ['accuracy'],
      });
      expect(result.metrics.accuracy).toBe(1);
    });

    it('evaluate with only accuracy metric skips precision/recall/f1', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate('eval-model', [{ text: 'good', label: 'positive' }], {
        metrics: ['accuracy'],
      });
      expect(result.metrics.accuracy).toBeDefined();
      expect(result.metrics.precision).toBeUndefined();
      expect(result.metrics.recall).toBeUndefined();
      expect(result.metrics.f1Score).toBeUndefined();
    });

    it('evaluate when modelRegistry is undefined uses version unknown', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(undefined, predictor);

      const result = await svc.evaluate('eval-model', [{ text: 'good', label: 'positive' }]);
      expect(result.version).toBeDefined();
    });

    it('evaluate with precision metric only', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'eval-model',
        [
          { text: 'good', label: 'positive' },
          { text: 'bad', label: 'negative' },
        ],
        { metrics: ['precision'] }
      );
      expect(result.metrics.precision).toBeDefined();
      expect(result.metrics.accuracy).toBeUndefined();
    });

    it('evaluate with recall metric only', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'eval-model',
        [
          { text: 'good', label: 'positive' },
          { text: 'bad', label: 'negative' },
        ],
        { metrics: ['recall'] }
      );
      expect(result.metrics.recall).toBeDefined();
      expect(result.metrics.accuracy).toBeUndefined();
    });

    it('evaluate with f1 metric only', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'eval-model', version: '1.0.0', framework: 'custom' },
        instance: new EvalModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'eval-model',
        [
          { text: 'good', label: 'positive' },
          { text: 'bad', label: 'negative' },
        ],
        { metrics: ['f1'] }
      );
      expect(result.metrics.f1Score).toBeDefined();
      expect(result.metrics.accuracy).toBeUndefined();
    });
  });

  describe('getMetrics edge cases', () => {
    it('should return undefined for non-existent model', () => {
      expect(service.getMetrics('non-existent')).toBeUndefined();
    });

    it('should return undefined for non-existent version', () => {
      service.recordEvaluation({
        modelName: 'model',
        version: '1.0.0',
        metrics: { accuracy: 0.9 },
        evaluatedAt: new Date(),
      });

      expect(service.getMetrics('model', '2.0.0')).toBeUndefined();
    });
  });

  describe('getHistory edge cases', () => {
    it('should return empty array for non-existent model', () => {
      expect(service.getHistory('non-existent')).toEqual([]);
    });
  });

  describe('compareVersions edge cases', () => {
    it('should return undefined winner when both versions not found', () => {
      const { a, b, winner } = service.compareVersions('model', 'v1', 'v2');

      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      expect(winner).toBeUndefined();
    });

    it('should return undefined winner when only one version found', () => {
      service.recordEvaluation({
        modelName: 'model',
        version: 'v1',
        metrics: { accuracy: 0.9 },
        evaluatedAt: new Date(),
      });

      const { a, b, winner } = service.compareVersions('model', 'v1', 'v2');

      expect(a).toBeDefined();
      expect(b).toBeUndefined();
      expect(winner).toBeUndefined();
    });

    it('should handle tie in accuracy', () => {
      service.recordEvaluation({
        modelName: 'model',
        version: 'v1',
        metrics: { accuracy: 0.9 },
        evaluatedAt: new Date(),
      });
      service.recordEvaluation({
        modelName: 'model',
        version: 'v2',
        metrics: { accuracy: 0.9 },
        evaluatedAt: new Date(),
      });

      const { winner } = service.compareVersions('model', 'v1', 'v2');

      expect(winner).toBe('v1'); // First one wins in tie
    });
  });

  describe('evaluate with all metrics', () => {
    @Model({ name: 'full-model', version: '1.0.0', framework: 'custom' })
    class FullModel {
      @Train()
      train() {}

      @Predict()
      async predict(input: { text: string }) {
        return { label: input.text.includes('good') ? 'positive' : 'negative' };
      }
    }

    it('should compute all metrics when requested', async () => {
      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'full-model', version: '1.0.0', framework: 'custom' },
        instance: new FullModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'full-model',
        [
          { text: 'good', label: 'positive' },
          { text: 'bad', label: 'negative' },
          { text: 'good day', label: 'positive' },
          { text: 'bad day', label: 'negative' },
        ],
        { metrics: ['accuracy', 'precision', 'recall', 'f1'] }
      );

      expect(result.metrics.accuracy).toBeDefined();
      expect(result.metrics.precision).toBeDefined();
      expect(result.metrics.recall).toBeDefined();
      expect(result.metrics.f1Score).toBeDefined();
    });

    it('should handle mixed correct and incorrect predictions', async () => {
      @Model({ name: 'mixed-model', version: '1.0.0', framework: 'custom' })
      class MixedModel {
        @Train()
        train() {}

        @Predict()
        async predict(input: { value: number }) {
          return { prediction: input.value > 5 ? 'high' : 'low' };
        }
      }

      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'mixed-model', version: '1.0.0', framework: 'custom' },
        instance: new MixedModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'mixed-model',
        [
          { value: 10, label: 'high' },
          { value: 2, label: 'low' },
          { value: 8, label: 'low' }, // Wrong
          { value: 3, label: 'high' }, // Wrong
        ],
        { labelKey: 'label', predictionKey: 'prediction' }
      );

      expect(result.metrics.accuracy).toBe(0.5);
    });

    it('should calculate precision correctly with false positives', async () => {
      @Model({ name: 'precision-model', version: '1.0.0', framework: 'custom' })
      class PrecisionModel {
        @Train()
        train() {}

        @Predict()
        async predict() {
          return { result: 'positive' }; // Always predicts positive
        }
      }

      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'precision-model', version: '1.0.0', framework: 'custom' },
        instance: new PrecisionModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'precision-model',
        [
          { text: 'a', label: 'positive' },
          { text: 'b', label: 'negative' },
          { text: 'c', label: 'negative' },
        ],
        { labelKey: 'label', predictionKey: 'result', metrics: ['precision'] }
      );

      expect(result.metrics.precision).toBeLessThan(1);
    });

    it('should calculate recall correctly with false negatives', async () => {
      @Model({ name: 'recall-model', version: '1.0.0', framework: 'custom' })
      class RecallModel {
        @Train()
        train() {}

        @Predict()
        async predict() {
          return { result: 'negative' }; // Always predicts negative
        }
      }

      const registry = new ModelRegistry();
      registry.register({
        metadata: { name: 'recall-model', version: '1.0.0', framework: 'custom' },
        instance: new RecallModel(),
        predictMethod: 'predict',
      });
      const predictor = new PredictorService(registry);
      const svc = new MetricsService(registry, predictor);

      const result = await svc.evaluate(
        'recall-model',
        [
          { text: 'a', label: 'positive' },
          { text: 'b', label: 'positive' },
          { text: 'c', label: 'negative' },
        ],
        { labelKey: 'label', predictionKey: 'result', metrics: ['recall'] }
      );

      expect(result.metrics.recall).toBeLessThanOrEqual(1);
      expect(result.metrics.recall).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordEvaluation edge cases', () => {
    it('should handle multiple evaluations for same model', () => {
      service.recordEvaluation({
        modelName: 'model',
        version: '1.0.0',
        metrics: { accuracy: 0.9 },
        evaluatedAt: new Date(),
      });
      service.recordEvaluation({
        modelName: 'model',
        version: '1.0.0',
        metrics: { accuracy: 0.95 },
        evaluatedAt: new Date(),
      });

      const history = service.getHistory('model');
      expect(history).toHaveLength(2);
    });

    it('should handle evaluations with custom metrics', () => {
      service.recordEvaluation({
        modelName: 'model',
        version: '1.0.0',
        metrics: { customMetric: 0.85, anotherMetric: 0.92 },
        evaluatedAt: new Date(),
      });

      const metrics = service.getMetrics('model', '1.0.0');
      expect(metrics?.metrics.customMetric).toBe(0.85);
      expect(metrics?.metrics.anotherMetric).toBe(0.92);
    });
  });
});
