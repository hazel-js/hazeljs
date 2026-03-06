import { StreamProcessor, WindowedBatch } from './stream.processor';
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

  it('processStream throws when item fails', async () => {
    @Pipeline('fail-proc')
    class FailPipeline {
      @Transform({ step: 1, name: 'fail' })
      fail() {
        throw new Error('Item failed');
      }
    }
    async function* gen() {
      yield {};
    }
    await expect(
      (async () => {
        for await (const _ of processor.processStream(new FailPipeline(), gen())) {
          break;
        }
      })()
    ).rejects.toThrow('Item failed');
  });

  it('tumblingWindow groups items by time window', async () => {
    async function* source() {
      yield { value: 1, timestamp: 100 };
      yield { value: 2, timestamp: 150 };
      yield { value: 3, timestamp: 250 };
    }
    const batches: { items: number[]; windowStart: number }[] = [];
    for await (const b of processor.tumblingWindow(source(), 100)) {
      batches.push({ items: b.items, windowStart: b.windowStart });
    }
    expect(batches).toHaveLength(2);
    expect(batches[0].items).toEqual([1, 2]);
    expect(batches[0].windowStart).toBe(100);
    expect(batches[1].items).toEqual([3]);
    expect(batches[1].windowStart).toBe(200);
  });

  it('slidingWindow emits overlapping windows', async () => {
    async function* source() {
      yield { value: 1, timestamp: 0 };
      yield { value: 2, timestamp: 50 };
    }
    const batches: WindowedBatch<number>[] = [];
    for await (const b of processor.slidingWindow(source(), 100, 50)) {
      batches.push(b);
    }
    expect(batches.length).toBeGreaterThanOrEqual(1);
    expect(batches[0].items).toContain(1);
  });

  it('sessionWindow groups by gap', async () => {
    const items: Array<{ v: number; ts: number }> = [
      { v: 1, ts: 0 },
      { v: 2, ts: 10 },
      { v: 3, ts: 100 },
    ];
    async function* gen() {
      for (const x of items) yield x;
    }
    const batches: WindowedBatch<{ v: number; ts: number }>[] = [];
    for await (const b of processor.sessionWindow(gen(), 50, (x) => x.ts)) {
      batches.push(b);
    }
    expect(batches).toHaveLength(2);
    expect(batches[0].items).toHaveLength(2);
    expect(batches[1].items).toHaveLength(1);
  });

  it('joinStreams merges by key', async () => {
    async function* left() {
      yield { id: 'a', name: 'Alice' };
    }
    async function* right() {
      yield { id: 'a', score: 100 };
    }
    const results: { name: string; score: number }[] = [];
    for await (const r of processor.joinStreams(
      left(),
      right(),
      (l) => l.id,
      (r) => r.id,
      (l, r) => ({ name: l.name, score: r.score })
    )) {
      results.push(r);
    }
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ name: 'Alice', score: 100 });
  });

  it('joinStreams when right arrives first buffers and matches', async () => {
    async function* left() {
      await new Promise((r) => setTimeout(r, 10));
      yield { id: 'x', leftVal: 1 };
    }
    async function* right() {
      yield { id: 'x', rightVal: 2 };
    }
    const results: { leftVal: number; rightVal: number }[] = [];
    for await (const r of processor.joinStreams(
      left(),
      right(),
      (l) => l.id,
      (r) => r.id,
      (l, r) => ({ leftVal: l.leftVal, rightVal: r.rightVal }),
      5000
    )) {
      results.push(r);
    }
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ leftVal: 1, rightVal: 2 });
  });
});
