import { MemorySource, MemorySink } from './memory.connector';

describe('MemorySource', () => {
  it('readAll returns all records', async () => {
    const source = new MemorySource([{ id: 1 }, { id: 2 }]);
    await source.open();
    const records = await source.readAll();
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ id: 1 });
    await source.close();
  });

  it('read yields records', async () => {
    const source = new MemorySource([1, 2, 3]);
    const out: number[] = [];
    for await (const r of source.read()) out.push(r);
    expect(out).toEqual([1, 2, 3]);
  });
});

describe('MemorySink', () => {
  it('captures written records', async () => {
    const sink = new MemorySink<{ x: number }>();
    await sink.open();
    await sink.write({ x: 1 });
    await sink.write({ x: 2 });
    await sink.close();
    expect(sink.records).toHaveLength(2);
    expect(sink.records[0]).toEqual({ x: 1 });
  });

  it('writeBatch captures batch', async () => {
    const sink = new MemorySink<number>();
    await sink.open();
    await sink.writeBatch([1, 2, 3]);
    expect(sink.records).toEqual([1, 2, 3]);
  });

  it('clear resets records', async () => {
    const sink = new MemorySink();
    await sink.write(1);
    sink.clear();
    expect(sink.records).toHaveLength(0);
  });
});
