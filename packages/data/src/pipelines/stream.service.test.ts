import { ETLService } from './etl.service';
import { StreamService } from './stream.service';
import { SchemaValidator } from '../validators/schema.validator';
import { Pipeline, Stream, Transform } from '../decorators';

@Pipeline('batch-test')
@Stream({ name: 'test', source: 'kafka://in', sink: 'kafka://out' })
class BatchTestPipeline {
  @Transform({ step: 1, name: 'inc' })
  inc(data: unknown) {
    return { v: ((data as { v: number }).v || 0) + 1 };
  }
}

describe('StreamService', () => {
  let streamService: StreamService;

  beforeEach(() => {
    const etlService = new ETLService(new SchemaValidator());
    streamService = new StreamService(etlService);
  });

  it('processes batch of items', async () => {
    const pipeline = new BatchTestPipeline();
    const results = await streamService.processBatch<{ v: number }>(pipeline, [{ v: 0 }, { v: 1 }]);
    expect(results).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('processStream yields results', async () => {
    const pipeline = new BatchTestPipeline();
    async function* source() {
      yield { v: 0 };
      yield { v: 5 };
    }
    const results: { v: number }[] = [];
    for await (const r of streamService.processStream<{ v: number }>(pipeline, source())) {
      results.push(r);
    }
    expect(results).toEqual([{ v: 1 }, { v: 6 }]);
  });
});
