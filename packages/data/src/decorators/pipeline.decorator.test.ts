import 'reflect-metadata';
import { Pipeline, getPipelineMetadata, hasPipelineMetadata } from './pipeline.decorator';
import { Transform, getTransformMetadata } from './transform.decorator';
import { Validate, getValidateMetadata } from './validate.decorator';
import { Stream, getStreamMetadata, hasStreamMetadata } from './stream.decorator';
import { Schema } from '../schema/schema';

describe('Pipeline decorator', () => {
  it('applies metadata with string name', () => {
    @Pipeline('my-pipeline')
    class TestPipeline {}

    const meta = getPipelineMetadata(TestPipeline);
    expect(meta?.name).toBe('my-pipeline');
    expect(hasPipelineMetadata(TestPipeline)).toBe(true);
  });

  it('applies metadata with options object', () => {
    @Pipeline({ name: 'custom' })
    class CustomPipeline {}

    expect(getPipelineMetadata(CustomPipeline)?.name).toBe('custom');
  });
});

describe('Transform decorator', () => {
  it('applies step metadata', () => {
    class TestClass {
      @Transform({ step: 1, name: 'normalize' })
      normalize() {}
    }
    const meta = getTransformMetadata(TestClass.prototype, 'normalize');
    expect(meta?.step).toBe(1);
    expect(meta?.name).toBe('normalize');
    expect(meta?.type).toBe('transform');
  });
});

describe('Validate decorator', () => {
  it('applies schema metadata', () => {
    const schema = Schema.object({ email: Schema.string().email() });
    class TestClass {
      @Validate({ step: 2, name: 'validate', schema })
      validate() {}
    }
    const meta = getValidateMetadata(TestClass.prototype, 'validate');
    expect(meta?.step).toBe(2);
    expect(meta?.schema).toBe(schema);
  });
});

describe('Stream decorator', () => {
  it('applies stream metadata', () => {
    @Stream({
      name: 'events',
      source: 'kafka://topic',
      sink: 'kafka://out',
      parallelism: 8,
    })
    class StreamPipeline {}

    const meta = getStreamMetadata(StreamPipeline);
    expect(meta?.name).toBe('events');
    expect(meta?.source).toBe('kafka://topic');
    expect(meta?.sink).toBe('kafka://out');
    expect(meta?.parallelism).toBe(8);
    expect(hasStreamMetadata(StreamPipeline)).toBe(true);
  });

  it('hasStreamMetadata false for undecorated', () => {
    class Plain {}
    expect(hasStreamMetadata(Plain)).toBe(false);
  });
});
