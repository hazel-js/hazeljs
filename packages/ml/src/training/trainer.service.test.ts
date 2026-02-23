import { ModelRegistry } from '../registry/model.registry';
import { TrainerService } from './trainer.service';
import { Model, Train, Predict } from '../decorators';

describe('TrainerService', () => {
  let registry: ModelRegistry;
  let trainer: TrainerService;

  @Model({ name: 'test-model', version: '1.0.0', framework: 'tensorflow' })
  class TestModel {
    @Train()
    async train(data: unknown) {
      return { accuracy: 0.95, loss: 0.05, inputSize: (data as { size?: number })?.size };
    }

    @Predict()
    async predict() {
      return { value: 1 };
    }
  }

  beforeEach(() => {
    registry = new ModelRegistry();
    trainer = new TrainerService(registry);
    const instance = new TestModel();
    registry.register({
      metadata: { name: 'test-model', version: '1.0.0', framework: 'tensorflow' },
      instance,
      trainMethod: 'train',
      predictMethod: 'predict',
    });
  });

  it('trains model and returns result', async () => {
    const result = await trainer.train('test-model', { size: 100 });
    expect(result).toEqual({ accuracy: 0.95, loss: 0.05, inputSize: 100 });
  });

  it('throws when model not found', async () => {
    await expect(trainer.train('unknown', {})).rejects.toThrow('Model not found: unknown');
  });

  it('throws when model has no training method', async () => {
    @Model({ name: 'no-train', version: '1.0.0', framework: 'tensorflow' })
    class NoTrainModel {
      @Predict()
      predict() {}
    }
    registry.register({
      metadata: { name: 'no-train', version: '1.0.0', framework: 'tensorflow' },
      instance: new NoTrainModel(),
      predictMethod: 'predict',
    });
    await expect(trainer.train('no-train', {})).rejects.toThrow('no-train has no training method');
  });

  it('discoverTrainMethod finds @Train decorated method', () => {
    const instance = new TestModel();
    expect(trainer.discoverTrainMethod(instance)).toBe('train');
  });

  it('discoverTrainMethod returns undefined for class without @Model', () => {
    class PlainClass {
      train() {}
    }
    expect(trainer.discoverTrainMethod(new PlainClass())).toBeUndefined();
  });
});
