import { Experiment, getExperimentMetadata, hasExperimentMetadata } from '../experiment.decorator';

describe('Experiment decorator', () => {
  it('should attach metadata to class', () => {
    @Experiment({
      name: 'test-experiment',
      description: 'Test experiment',
      tags: ['test', 'ml'],
    })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('test-experiment');
    expect(metadata?.description).toBe('Test experiment');
    expect(metadata?.tags).toEqual(['test', 'ml']);
  });

  it('should use class name as default experiment name', () => {
    @Experiment()
    class MyExperiment {}

    const metadata = getExperimentMetadata(MyExperiment);

    expect(metadata?.name).toBe('MyExperiment');
  });

  it('should set default autoLogParams to true', () => {
    @Experiment()
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.autoLogParams).toBe(true);
  });

  it('should set default autoLogMetrics to true', () => {
    @Experiment()
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.autoLogMetrics).toBe(true);
  });

  it('should allow disabling autoLogParams', () => {
    @Experiment({ autoLogParams: false })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.autoLogParams).toBe(false);
  });

  it('should allow disabling autoLogMetrics', () => {
    @Experiment({ autoLogMetrics: false })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.autoLogMetrics).toBe(false);
  });

  it('should handle optional description', () => {
    @Experiment({ name: 'test' })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.description).toBeUndefined();
  });

  it('should handle optional tags', () => {
    @Experiment({ name: 'test' })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.tags).toBeUndefined();
  });

  it('should handle empty tags array', () => {
    @Experiment({ name: 'test', tags: [] })
    class TestExperiment {}

    const metadata = getExperimentMetadata(TestExperiment);

    expect(metadata?.tags).toEqual([]);
  });
});

describe('hasExperimentMetadata', () => {
  it('should return true for decorated class', () => {
    @Experiment({ name: 'test' })
    class TestExperiment {}

    expect(hasExperimentMetadata(TestExperiment)).toBe(true);
  });

  it('should return false for non-decorated class', () => {
    class TestExperiment {}

    expect(hasExperimentMetadata(TestExperiment)).toBe(false);
  });
});

describe('getExperimentMetadata', () => {
  it('should return undefined for non-decorated class', () => {
    class TestExperiment {}

    expect(getExperimentMetadata(TestExperiment)).toBeUndefined();
  });
});
