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

  it('throws when train method is not a function', async () => {
    const fakeInstance = { train: 'not-a-function' };
    registry.register({
      metadata: { name: 'broken-train', version: '1.0.0', framework: 'custom' },
      instance: fakeInstance,
      trainMethod: 'train',
      predictMethod: undefined,
    });
    await expect(trainer.train('broken-train', {})).rejects.toThrow(
      'Training method train not found on model'
    );
  });

  it('should train with specific version', async () => {
    @Model({ name: 'versioned-model', version: '2.0.0', framework: 'custom' })
    class VersionedModel {
      @Train()
      async train(data: unknown) {
        return { version: '2.0.0', data };
      }

      @Predict()
      predict() {}
    }

    const instance = new VersionedModel();
    registry.register({
      metadata: { name: 'versioned-model', version: '2.0.0', framework: 'custom' },
      instance,
      trainMethod: 'train',
      predictMethod: 'predict',
    });

    const result = await trainer.train('versioned-model', { test: true }, '2.0.0');
    expect((result as any).version).toBe('2.0.0');
  });

  it('should handle training errors gracefully', async () => {
    @Model({ name: 'error-model', version: '1.0.0', framework: 'custom' })
    class ErrorModel {
      @Train()
      async train() {
        throw new Error('Training failed');
      }

      @Predict()
      predict() {}
    }

    const instance = new ErrorModel();
    registry.register({
      metadata: { name: 'error-model', version: '1.0.0', framework: 'custom' },
      instance,
      trainMethod: 'train',
      predictMethod: 'predict',
    });

    await expect(trainer.train('error-model', {})).rejects.toThrow('Training failed');
  });

  it('should discover train method from decorated class', () => {
    @Model({ name: 'discover-model', version: '1.0.0', framework: 'custom' })
    class DiscoverModel {
      @Train()
      customTrainMethod() {}

      @Predict()
      predict() {}
    }

    const instance = new DiscoverModel();
    const method = trainer.discoverTrainMethod(instance);
    expect(method).toBe('customTrainMethod');
  });

  it('should return undefined when no train method decorated', () => {
    @Model({ name: 'no-decorator', version: '1.0.0', framework: 'custom' })
    class NoDecoratorModel {
      train() {}

      @Predict()
      predict() {}
    }

    const instance = new NoDecoratorModel();
    const method = trainer.discoverTrainMethod(instance);
    expect(method).toBeUndefined();
  });
});
