import 'reflect-metadata';
import { Model, getModelMetadata, hasModelMetadata } from './model.decorator';
import { Train, getTrainMetadata, hasTrainMetadata } from './train.decorator';
import { Predict, getPredictMetadata, hasPredictMetadata } from './predict.decorator';

describe('Model decorator', () => {
  it('applies metadata to class', () => {
    @Model({ name: 'test-model', version: '1.0.0', framework: 'tensorflow' })
    class TestModel {}

    const meta = getModelMetadata(TestModel);
    expect(meta).toEqual({
      name: 'test-model',
      version: '1.0.0',
      framework: 'tensorflow',
      description: '',
      tags: [],
    });
    expect(hasModelMetadata(TestModel)).toBe(true);
  });

  it('merges optional fields', () => {
    @Model({
      name: 'custom',
      version: '2.0.0',
      framework: 'onnx',
      description: 'A model',
      tags: ['production'],
    })
    class CustomModel {}

    const meta = getModelMetadata(CustomModel);
    expect(meta?.description).toBe('A model');
    expect(meta?.tags).toEqual(['production']);
  });

  it('hasModelMetadata returns false for undecorated class', () => {
    class PlainClass {}
    expect(hasModelMetadata(PlainClass)).toBe(false);
    expect(getModelMetadata(PlainClass)).toBeUndefined();
  });
});

describe('Train decorator', () => {
  it('applies metadata to method', () => {
    class TestClass {
      @Train({ pipeline: 'default', epochs: 5 })
      train() {}
    }

    const meta = getTrainMetadata(TestClass.prototype, 'train');
    expect(meta).toEqual({
      pipeline: 'default',
      batchSize: 32,
      epochs: 5,
    });
    expect(hasTrainMetadata(TestClass.prototype, 'train')).toBe(true);
  });

  it('uses defaults when no options', () => {
    class TestClass {
      @Train()
      train() {}
    }

    const meta = getTrainMetadata(TestClass.prototype, 'train');
    expect(meta?.batchSize).toBe(32);
    expect(meta?.epochs).toBe(10);
  });

  it('hasTrainMetadata returns false for undecorated method', () => {
    class TestClass {
      train() {}
    }
    expect(hasTrainMetadata(TestClass.prototype, 'train')).toBe(false);
  });
});

describe('Predict decorator', () => {
  it('applies metadata to method', () => {
    class TestClass {
      @Predict({ endpoint: '/predict', batch: true })
      predict() {}
    }

    const meta = getPredictMetadata(TestClass.prototype, 'predict');
    expect(meta).toEqual({
      batch: true,
      endpoint: '/predict',
    });
    expect(hasPredictMetadata(TestClass.prototype, 'predict')).toBe(true);
  });

  it('uses defaults when no options', () => {
    class TestClass {
      @Predict()
      predict() {}
    }

    const meta = getPredictMetadata(TestClass.prototype, 'predict');
    expect(meta?.batch).toBe(false);
    expect(meta?.endpoint).toBe('/predict');
  });
});
