import {
  FeatureView,
  getFeatureViewMetadata,
  hasFeatureViewMetadata,
} from '../feature-view.decorator';

describe('FeatureView decorator', () => {
  it('should attach metadata to class', () => {
    @FeatureView({
      name: 'user-features',
      entities: ['user'],
      description: 'User feature view',
    })
    class UserFeatures {}

    const metadata = getFeatureViewMetadata(UserFeatures);

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('user-features');
    expect(metadata?.entities).toEqual(['user']);
    expect(metadata?.description).toBe('User feature view');
  });

  it('should default online to true', () => {
    @FeatureView({ name: 'test', entities: ['user'] })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.online).toBe(true);
  });

  it('should default offline to true', () => {
    @FeatureView({ name: 'test', entities: ['user'] })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.offline).toBe(true);
  });

  it('should allow setting online to false', () => {
    @FeatureView({ name: 'test', entities: ['user'], online: false })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.online).toBe(false);
  });

  it('should allow setting offline to false', () => {
    @FeatureView({ name: 'test', entities: ['user'], offline: false })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.offline).toBe(false);
  });

  it('should handle multiple entities', () => {
    @FeatureView({ name: 'test', entities: ['user', 'product', 'session'] })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.entities).toEqual(['user', 'product', 'session']);
  });

  it('should handle optional ttl', () => {
    @FeatureView({ name: 'test', entities: ['user'], ttl: 3600 })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.ttl).toBe(3600);
  });

  it('should handle batch source', () => {
    @FeatureView({
      name: 'test',
      entities: ['user'],
      source: { type: 'batch', config: { path: '/data/features' } },
    })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.source?.type).toBe('batch');
    expect(metadata?.source?.config).toEqual({ path: '/data/features' });
  });

  it('should handle stream source', () => {
    @FeatureView({
      name: 'test',
      entities: ['user'],
      source: { type: 'stream', config: { topic: 'features' } },
    })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.source?.type).toBe('stream');
  });

  it('should handle request source', () => {
    @FeatureView({
      name: 'test',
      entities: ['user'],
      source: { type: 'request' },
    })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.source?.type).toBe('request');
  });

  it('should handle source without config', () => {
    @FeatureView({
      name: 'test',
      entities: ['user'],
      source: { type: 'batch' },
    })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.source?.type).toBe('batch');
    expect(metadata?.source?.config).toBeUndefined();
  });

  it('should handle features without optional fields', () => {
    @FeatureView({ name: 'test', entities: ['user'] })
    class TestFeatures {}

    const metadata = getFeatureViewMetadata(TestFeatures);

    expect(metadata?.description).toBeUndefined();
    expect(metadata?.ttl).toBeUndefined();
    expect(metadata?.source).toBeUndefined();
  });
});

describe('hasFeatureViewMetadata', () => {
  it('should return true for decorated class', () => {
    @FeatureView({ name: 'test', entities: ['user'] })
    class TestFeatures {}

    expect(hasFeatureViewMetadata(TestFeatures)).toBe(true);
  });

  it('should return false for non-decorated class', () => {
    class TestFeatures {}

    expect(hasFeatureViewMetadata(TestFeatures)).toBe(false);
  });
});

describe('getFeatureViewMetadata', () => {
  it('should return undefined for non-decorated class', () => {
    class TestFeatures {}

    expect(getFeatureViewMetadata(TestFeatures)).toBeUndefined();
  });
});
