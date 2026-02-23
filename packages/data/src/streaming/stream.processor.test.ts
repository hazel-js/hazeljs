import { StreamProcessor } from './stream.processor';
import { ETLService } from '../pipelines/etl.service';
import { SchemaValidator } from '../validators/schema.validator';
import { Pipeline, Transform } from '../decorators';

@Pipeline('proc-test')
class ProcTestPipeline {
  @Transform({ step: 1, name: 'inc' })
  inc(data: unknown) {
    return { v: ((data as { v: number }).v || 0) + 1 };
  }
}

describe('StreamProcessor', () => {
  let processor: StreamProcessor;

  beforeEach(() => {
    processor = new StreamProcessor(new ETLService(new SchemaValidator()));
  });

  it('processItem runs pipeline on single item', async () => {
    const pipeline = new ProcTestPipeline();
    const result = await processor.processItem<{ v: number }>(pipeline, { v: 0 });
    expect(result).toEqual({ v: 1 });
  });

  it('processStream yields processed items', async () => {
    const pipeline = new ProcTestPipeline();
    async function* gen() {
      yield { v: 1 };
      yield { v: 2 };
    }
    const results: { v: number }[] = [];
    for await (const r of processor.processStream<{ v: number }>(pipeline, gen())) {
      results.push(r);
    }
    expect(results).toEqual([{ v: 2 }, { v: 3 }]);
  });
});
