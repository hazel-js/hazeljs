import {
  DataContract,
  getDataContractMetadata,
  hasDataContractMetadata,
} from '../contract.decorator';

describe('DataContract decorator', () => {
  it('should attach metadata to class', () => {
    @DataContract({
      name: 'test-contract',
      version: '1.0.0',
      description: 'Test contract',
      owner: 'data-team',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
    })
    class TestContract {}

    const metadata = getDataContractMetadata(TestContract);

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('test-contract');
    expect(metadata?.version).toBe('1.0.0');
    expect(metadata?.description).toBe('Test contract');
    expect(metadata?.owner).toBe('data-team');
    expect(metadata?.status).toBe('active');
    expect(metadata?.createdAt).toBeInstanceOf(Date);
    expect(metadata?.updatedAt).toBeInstanceOf(Date);
  });

  it('should handle optional fields', () => {
    @DataContract({
      name: 'minimal-contract',
      version: '1.0.0',
      owner: 'team-a',
      schema: {
        type: 'object',
        properties: {},
      },
    })
    class MinimalContract {}

    const metadata = getDataContractMetadata(MinimalContract);

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('minimal-contract');
    expect(metadata?.description).toBeUndefined();
  });

  it('should handle consumers and producers', () => {
    @DataContract({
      name: 'consumed-contract',
      version: '1.0.0',
      owner: 'data-platform',
      schema: { type: 'object', properties: {} },
      consumers: ['service-a', 'service-b'],
      producers: ['producer-1'],
    })
    class ConsumedContract {}

    const metadata = getDataContractMetadata(ConsumedContract);

    expect(metadata?.consumers).toEqual(['service-a', 'service-b']);
    expect(metadata?.producers).toEqual(['producer-1']);
  });

  it('should handle SLA configuration', () => {
    @DataContract({
      name: 'sla-contract',
      version: '1.0.0',
      owner: 'analytics-team',
      schema: { type: 'object', properties: {} },
      sla: {
        freshness: {
          maxDelayMinutes: 60,
          checkIntervalMinutes: 15,
        },
        completeness: {
          minCompleteness: 0.95,
          requiredFields: ['id', 'timestamp'],
        },
        quality: {
          minQualityScore: 0.9,
          checks: ['no-nulls', 'valid-format'],
        },
        availability: {
          minUptime: 0.99,
        },
      },
    })
    class SLAContract {}

    const metadata = getDataContractMetadata(SLAContract);

    expect(metadata?.sla?.freshness?.maxDelayMinutes).toBe(60);
    expect(metadata?.sla?.completeness?.minCompleteness).toBe(0.95);
    expect(metadata?.sla?.quality?.minQualityScore).toBe(0.9);
    expect(metadata?.sla?.availability?.minUptime).toBe(0.99);
  });

  it('should return undefined for non-decorated class', () => {
    class NotDecorated {}

    const metadata = getDataContractMetadata(NotDecorated);

    expect(metadata).toBeUndefined();
  });

  it('should handle complex schema', () => {
    @DataContract({
      name: 'complex-contract',
      version: '2.0.0',
      owner: 'ml-team',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          metadata: {
            type: 'object',
            properties: {
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['id'],
      },
    })
    class ComplexContract {}

    const metadata = getDataContractMetadata(ComplexContract);

    expect(metadata?.schema.properties).toBeDefined();
    expect(metadata?.schema.required).toEqual(['id']);
  });

  it('should handle tags', () => {
    @DataContract({
      name: 'tagged-contract',
      version: '1.0.0',
      owner: 'platform-team',
      schema: { type: 'object', properties: {} },
      tags: ['pii', 'critical', 'production'],
    })
    class TaggedContract {}

    const metadata = getDataContractMetadata(TaggedContract);

    expect(metadata?.tags).toEqual(['pii', 'critical', 'production']);
  });

  describe('hasDataContractMetadata', () => {
    it('should return true for decorated class', () => {
      @DataContract({
        name: 'test',
        version: '1.0.0',
        owner: 'team',
        schema: { type: 'object', properties: {} },
      })
      class DecoratedClass {}

      expect(hasDataContractMetadata(DecoratedClass)).toBe(true);
    });

    it('should return false for non-decorated class', () => {
      class NonDecoratedClass {}

      expect(hasDataContractMetadata(NonDecoratedClass)).toBe(false);
    });
  });
});
