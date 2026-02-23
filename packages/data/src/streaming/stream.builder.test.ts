import { ETLService } from '../pipelines/etl.service';
import { StreamBuilder } from './stream.builder';
import { SchemaValidator } from '../validators/schema.validator';
import { Stream, Transform } from '../decorators';

@Stream({
  name: 'test-stream',
  source: 'kafka://events',
  sink: 'kafka://processed',
  parallelism: 4,
})
class TestStreamPipeline {
  @Transform({ step: 1, name: 'parse' })
  parse(data: unknown) {
    return data;
  }
}

describe('StreamBuilder', () => {
  let builder: StreamBuilder;

  beforeEach(() => {
    builder = new StreamBuilder(new ETLService(new SchemaValidator()));
  });

  it('builds config from @Stream pipeline', () => {
    const pipeline = new TestStreamPipeline();
    const { jobConfig, jobGraph } = builder.buildConfig(pipeline);

    expect(jobConfig.jobName).toBe('TestStreamPipeline');
    expect(jobConfig.parallelism).toBe(4);
    expect(jobGraph.source.topic).toBe('events');
    expect(jobGraph.sink.topic).toBe('processed');
    expect(jobGraph.transformations).toHaveLength(1);
  });

  it('allows config override', () => {
    const pipeline = new TestStreamPipeline();
    const { jobConfig } = builder.buildConfig(pipeline, { parallelism: 8 });
    expect(jobConfig.parallelism).toBe(8);
  });

  it('throws when pipeline not @Stream decorated', () => {
    class PlainPipeline {}
    expect(() => builder.buildConfig(new PlainPipeline())).toThrow(
      'Pipeline must be decorated with @Stream'
    );
  });
});
