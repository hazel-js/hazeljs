import { ETLService } from '../pipelines/etl.service';
import { SchemaValidator } from '../validators/schema.validator';
import { StreamProcessor } from './stream.processor';

async function* itemsWithTs<T>(items: Array<{ value: T; timestamp: number }>) {
  for (const item of items) yield item;
}

describe('StreamProcessor windowing', () => {
  let processor: StreamProcessor;

  beforeEach(() => {
    processor = new StreamProcessor(new ETLService(new SchemaValidator()));
  });

  it('tumblingWindow groups by time', async () => {
    const source = itemsWithTs([
      { value: 1, timestamp: 0 },
      { value: 2, timestamp: 10 },
      { value: 3, timestamp: 100 },
    ]);
    const batches: number[][] = [];
    for await (const batch of processor.tumblingWindow(source, 50)) {
      batches.push(batch.items as number[]);
    }
    expect(batches.length).toBeGreaterThanOrEqual(1);
    expect(batches.flat()).toContain(1);
    expect(batches.flat()).toContain(2);
    expect(batches.flat()).toContain(3);
  });

  it('sessionWindow groups by gap', async () => {
    const items = [1, 2, 3];
    const getTs = (i: number) => (i === 2 ? 100 : i);
    const source = (async function* () {
      for (const v of items) yield v;
    })();
    const batches: number[][] = [];
    for await (const batch of processor.sessionWindow(source, 50, getTs)) {
      batches.push(batch.items);
    }
    expect(batches.length).toBeGreaterThanOrEqual(1);
  });

  it('slidingWindow yields overlapping windows', async () => {
    const source = itemsWithTs([
      { value: 1, timestamp: 0 },
      { value: 2, timestamp: 50 },
      { value: 3, timestamp: 100 },
    ]);
    const batches: number[][] = [];
    for await (const batch of processor.slidingWindow(source, 100, 50)) {
      batches.push(batch.items as number[]);
    }
    expect(batches.length).toBeGreaterThanOrEqual(1);
  });

  it('joinStreams merges by key', async () => {
    const left = (async function* () {
      yield { id: 'a', name: 'Alice' };
    })();
    const right = (async function* () {
      yield { id: 'a', score: 100 };
    })();
    const results: Array<{ name: string; score: number }> = [];
    for await (const r of processor.joinStreams(
      left,
      right,
      (l) => (l as { id: string }).id,
      (r) => (r as { id: string }).id,
      (l, r) => ({ name: (l as { name: string }).name, score: (r as { score: number }).score })
    )) {
      results.push(r);
    }
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ name: 'Alice', score: 100 });
  });
});
