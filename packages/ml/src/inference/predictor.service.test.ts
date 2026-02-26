import { ModelRegistry } from '../registry/model.registry';
import { PredictorService } from './predictor.service';
import { Model, Train, Predict } from '../decorators';

describe('PredictorService', () => {
  let registry: ModelRegistry;
  let predictor: PredictorService;

  @Model({ name: 'test-model', version: '1.0.0', framework: 'tensorflow' })
  class TestModel {
    @Train()
    async train() {
      return { accuracy: 0.9 };
    }

    @Predict()
    async predict(input: unknown) {
      return { sentiment: 'positive', score: 0.92, input };
    }
  }

  beforeEach(() => {
    registry = new ModelRegistry();
    predictor = new PredictorService(registry);
    registry.register({
      metadata: { name: 'test-model', version: '1.0.0', framework: 'tensorflow' },
      instance: new TestModel(),
      trainMethod: 'train',
      predictMethod: 'predict',
    });
  });

  it('predicts and returns result', async () => {
    const result = await predictor.predict('test-model', 'hello');
    expect(result).toEqual({ sentiment: 'positive', score: 0.92, input: 'hello' });
  });

  it('predicts with specific version', async () => {
    const result = await predictor.predict('test-model', 'hi', '1.0.0');
    expect(result.sentiment).toBe('positive');
  });

  it('throws when model not found', async () => {
    await expect(predictor.predict('unknown', {})).rejects.toThrow('Model not found: unknown');
  });

  it('throws when model has no prediction method', async () => {
    @Model({ name: 'no-predict', version: '1.0.0', framework: 'tensorflow' })
    class NoPredictModel {
      @Train()
      train() {}
    }
    registry.register({
      metadata: { name: 'no-predict', version: '1.0.0', framework: 'tensorflow' },
      instance: new NoPredictModel(),
      trainMethod: 'train',
    });
    await expect(predictor.predict('no-predict', {})).rejects.toThrow(
      'no-predict has no prediction method'
    );
  });

  it('discoverPredictMethod finds @Predict decorated method', () => {
    const instance = new TestModel();
    expect(predictor.discoverPredictMethod(instance)).toBe('predict');
  });
});
