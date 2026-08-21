import { PipelineRunner } from './pipeline.runner';
import { MemorySource, MemorySink } from '../connectors/memory.connector';
import { QualityService } from '../quality/quality.service';
import { TelemetryService } from '../telemetry/telemetry';
import { SchemaValidator } from '../validators/schema.validator';
import { ETLService } from './etl.service';
import { Pipeline } from '../decorators/pipeline.decorator';
import { Transform } from '../decorators/transform.decorator';
import { PipelineBase } from './pipeline.base';

@Pipeline('test-runner-pipeline')
class DoublePipeline extends PipelineBase {
  constructor(etl: ETLService) {
    super(etl);
  }

  @Transform({ step: 1, name: 'double' })
  async double(data: { n: number }): Promise<{ n: number }> {
    return { n: data.n * 2 };
  }
}

describe('PipelineRunner', () => {
  beforeEach(() => {
    TelemetryService.reset();
  });

  it('runs source → transform → sink', async () => {
    const source = new MemorySource([{ n: 1 }, { n: 2 }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner();

    const result = await runner.run({
      source,
      sink,
      transform: (r) => ({ ...(r as object), ok: true }),
      pipelineName: 'test',
    });

    expect(result.read).toBe(2);
    expect(result.written).toBe(2);
    expect(result.failed).toBe(0);
    expect(sink.records).toEqual([
      { n: 1, ok: true },
      { n: 2, ok: true },
    ]);
  });

  it('routes failures to DLQ', async () => {
    const source = new MemorySource([{ n: 1 }, { n: 2 }]);
    const sink = new MemorySink();
    const dlq = new MemorySink();
    const runner = new PipelineRunner();

    const result = await runner.run({
      source,
      sink,
      dlqSink: dlq,
      transform: (r) => {
        if ((r as { n: number }).n === 2) throw new Error('boom');
        return r;
      },
    });

    expect(result.written).toBe(1);
    expect(result.failed).toBe(1);
    expect(dlq.records).toHaveLength(1);
  });

  it('runs quality checks after transform', async () => {
    const quality = new QualityService();
    quality.registerCheck('notNull', quality.notNull(['id']));
    const source = new MemorySource([{ id: 1 }, { id: null }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner(undefined, quality);

    const result = await runner.run({
      source,
      sink,
      qualityDataset: 'items',
    });

    expect(result.quality).toBeDefined();
    expect(result.quality!.passed).toBe(false);
  });

  it('executes decorator pipeline via ETLService', async () => {
    const validator = new SchemaValidator();
    const etl = new ETLService(validator);
    const pipeline = new DoublePipeline(etl);
    const source = new MemorySource([{ n: 3 }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner(etl);

    const result = await runner.run({ source, sink, pipeline });
    expect(result.written).toBe(1);
    expect(sink.records).toEqual([{ n: 6 }]);
  });

  it('throws when pipeline is set without ETLService', async () => {
    const source = new MemorySource([{ n: 1 }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner();
    const result = await runner.run({
      source,
      sink,
      pipeline: {},
      dlqSink: new MemorySink(),
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('ETLService is required');
  });

  it('skips null transform results when skipNull is true', async () => {
    const source = new MemorySource([{ n: 1 }, { n: 2 }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner();
    const result = await runner.run({
      source,
      sink,
      skipNull: true,
      transform: (r) => ((r as { n: number }).n === 1 ? null : r),
    });
    expect(result.skipped).toBe(1);
    expect(result.written).toBe(1);
  });

  it('expands array transform output into multiple rows', async () => {
    const source = new MemorySource([{ tags: ['a', 'b'] }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner();
    const result = await runner.run({
      source,
      sink,
      transform: (r) => {
        const row = r as { tags: string[] };
        return row.tags.map((t) => ({ tag: t }));
      },
    });
    expect(result.written).toBe(2);
    expect(sink.records).toEqual([{ tag: 'a' }, { tag: 'b' }]);
  });

  it('skips null entries inside exploded rows', async () => {
    const source = new MemorySource([{ n: 1 }]);
    const sink = new MemorySink();
    const runner = new PipelineRunner();
    const result = await runner.run({
      source,
      sink,
      transform: () => [null, { ok: true }, undefined],
    });
    expect(result.skipped).toBe(2);
    expect(result.written).toBe(1);
  });

  it('fails the run when failOnQuality is true and checks fail', async () => {
    const quality = new QualityService();
    quality.registerCheck('notNull', quality.notNull(['id']));
    const runner = new PipelineRunner(undefined, quality);
    await expect(
      runner.run({
        source: new MemorySource([{ id: null }]),
        sink: new MemorySink(),
        qualityDataset: 'items',
        failOnQuality: true,
      })
    ).rejects.toThrow(/Quality checks failed/);
  });

  it('logs when DLQ write fails', async () => {
    const source = new MemorySource([{ n: 1 }]);
    const sink = new MemorySink();
    const dlq: MemorySink = {
      name: 'bad-dlq',
      records: [],
      async open() {},
      async close() {},
      async write() {
        throw new Error('dlq down');
      },
      async writeBatch() {},
    } as unknown as MemorySink;
    const runner = new PipelineRunner();
    const result = await runner.run({
      source,
      sink,
      dlqSink: dlq,
      transform: () => {
        throw 'string-fail';
      },
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toBe('string-fail');
  });
});
