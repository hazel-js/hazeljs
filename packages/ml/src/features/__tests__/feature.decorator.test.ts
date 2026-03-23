import { Feature, getFeatureMetadata, hasFeatureMetadata } from '../feature.decorator';

describe('Feature decorator', () => {
  it('should attach metadata to property', () => {
    class TestFeatures {
      @Feature({ valueType: 'number', description: 'Test feature' })
      testFeature!: number;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata).toBeDefined();
    expect(metadata).toHaveLength(1);
    expect(metadata![0].propertyKey).toBe('testFeature');
    expect(metadata![0].valueType).toBe('number');
    expect(metadata![0].description).toBe('Test feature');
  });

  it('should use property key as default name', () => {
    class TestFeatures {
      @Feature({ valueType: 'string' })
      myFeature!: string;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].name).toBe('myFeature');
  });

  it('should use custom name when provided', () => {
    class TestFeatures {
      @Feature({ name: 'custom_name', valueType: 'string' })
      myFeature!: string;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].name).toBe('custom_name');
  });

  it('should support all value types', () => {
    class TestFeatures {
      @Feature({ valueType: 'string' })
      stringFeature!: string;

      @Feature({ valueType: 'number' })
      numberFeature!: number;

      @Feature({ valueType: 'boolean' })
      booleanFeature!: boolean;

      @Feature({ valueType: 'array' })
      arrayFeature!: unknown[];

      @Feature({ valueType: 'object' })
      objectFeature!: object;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata).toHaveLength(5);
    expect(metadata![0].valueType).toBe('string');
    expect(metadata![1].valueType).toBe('number');
    expect(metadata![2].valueType).toBe('boolean');
    expect(metadata![3].valueType).toBe('array');
    expect(metadata![4].valueType).toBe('object');
  });

  it('should handle optional tags', () => {
    class TestFeatures {
      @Feature({ valueType: 'string', tags: ['demographic', 'pii'] })
      segment!: string;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].tags).toEqual(['demographic', 'pii']);
  });

  it('should handle optional ttl', () => {
    class TestFeatures {
      @Feature({ valueType: 'number', ttl: 3600 })
      score!: number;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].ttl).toBe(3600);
  });

  it('should handle optional entityExtractor', () => {
    const extractor = (input: unknown) => String(input);

    class TestFeatures {
      @Feature({ valueType: 'string', entityExtractor: extractor })
      userId!: string;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].entityExtractor).toBe(extractor);
  });

  it('should handle multiple features on same class', () => {
    class TestFeatures {
      @Feature({ valueType: 'string' })
      feature1!: string;

      @Feature({ valueType: 'number' })
      feature2!: number;

      @Feature({ valueType: 'boolean' })
      feature3!: boolean;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata).toHaveLength(3);
    expect(metadata![0].propertyKey).toBe('feature1');
    expect(metadata![1].propertyKey).toBe('feature2');
    expect(metadata![2].propertyKey).toBe('feature3');
  });

  it('should handle features without optional fields', () => {
    class TestFeatures {
      @Feature({ valueType: 'string' })
      simpleFeature!: string;
    }

    const metadata = getFeatureMetadata(TestFeatures);

    expect(metadata![0].description).toBeUndefined();
    expect(metadata![0].tags).toBeUndefined();
    expect(metadata![0].ttl).toBeUndefined();
    expect(metadata![0].entityExtractor).toBeUndefined();
  });
});

describe('hasFeatureMetadata', () => {
  it('should return true for decorated class', () => {
    class TestFeatures {
      @Feature({ valueType: 'string' })
      feature!: string;
    }

    expect(hasFeatureMetadata(TestFeatures)).toBe(true);
  });

  it('should return false for non-decorated class', () => {
    class TestFeatures {
      feature!: string;
    }

    expect(hasFeatureMetadata(TestFeatures)).toBe(false);
  });
});

describe('getFeatureMetadata', () => {
  it('should return undefined for non-decorated class', () => {
    class TestFeatures {
      feature!: string;
    }

    expect(getFeatureMetadata(TestFeatures)).toBeUndefined();
  });
});
