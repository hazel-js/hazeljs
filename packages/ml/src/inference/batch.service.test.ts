import { ModelRegistry } from '../registry/model.registry';
import { PredictorService } from './predictor.service';
import { BatchService } from './batch.service';
import { Model, Train, Predict } from '../decorators';

describe('BatchService', () => {
  let batchService: BatchService;

  @Model({ name: 'batch-model', version: '1.0.0', framework: 'tensorflow' })
  class BatchModel {
    @Train()
    train() {}

    @Predict()
    async predict(input: unknown) {
      return { value: (input as number) * 2 };
    }
  }

  beforeEach(() => {
    const registry = new ModelRegistry();
    registry.register({
      metadata: { name: 'batch-model', version: '1.0.0', framework: 'tensorflow' },
      instance: new BatchModel(),
      predictMethod: 'predict',
    });
    batchService = new BatchService(new PredictorService(registry));
  });

  it('processes batch of inputs', async () => {
    const results = await batchService.predictBatch('batch-model', [1, 2, 3]);
    expect(results).toEqual([{ value: 2 }, { value: 4 }, { value: 6 }]);
  });

  it('respects batchSize option', async () => {
    const results = await batchService.predictBatch('batch-model', [1, 2, 3, 4, 5], {
      batchSize: 2,
    });
    expect(results).toHaveLength(5);
  });

  it('throws when model not found', async () => {
    await expect(batchService.predictBatch('unknown', [1])).rejects.toThrow(
      'Model not found: unknown'
    );
  });
});
