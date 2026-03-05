import { MultiStore } from '../../stores/multi.store';
import { MemoryStore } from '../../stores/memory.store';
import type { PromptEntry } from '../../stores/store.interface';

function entry(key: string, version = '1.0.0', template = 'Hi {x}'): PromptEntry {
  return { key, version, template, metadata: { name: key, version }, storedAt: new Date().toISOString() };
}

describe('MultiStore', () => {
  it('name reflects inner store names', () => {
    const multi = new MultiStore([new MemoryStore(), new MemoryStore()]);
    expect(multi.name).toContain('memory');
  });

  it('set() fans out to all stores', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    const multi = new MultiStore([s1, s2]);
    await multi.set(entry('fan:key'));
    expect(await s1.has('fan:key', '1.0.0')).toBe(true);
    expect(await s2.has('fan:key', '1.0.0')).toBe(true);
  });

  it('get() returns from first store that has the entry', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    await s2.set(entry('only:s2', '1.0.0', 'from s2'));
    const multi = new MultiStore([s1, s2]);
    const result = await multi.get('only:s2', '1.0.0');
    expect(result?.template).toBe('from s2');
  });

  it('get() returns undefined when none have the entry', async () => {
    const multi = new MultiStore([new MemoryStore()]);
    expect(await multi.get('missing:key')).toBeUndefined();
  });

  it('has() returns true if any store has the entry', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    await s2.set(entry('has:s2'));
    const multi = new MultiStore([s1, s2]);
    expect(await multi.has('has:s2', '1.0.0')).toBe(true);
  });

  it('has() returns false if no store has the entry', async () => {
    const multi = new MultiStore([new MemoryStore()]);
    expect(await multi.has('nope')).toBe(false);
  });

  it('delete() removes from all stores', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    await s1.set(entry('del:key'));
    await s2.set(entry('del:key'));
    const multi = new MultiStore([s1, s2]);
    await multi.delete('del:key', '1.0.0');
    expect(await s1.has('del:key', '1.0.0')).toBe(false);
    expect(await s2.has('del:key', '1.0.0')).toBe(false);
  });

  it('keys() returns union of keys across stores', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    await s1.set(entry('k1'));
    await s2.set(entry('k2'));
    const multi = new MultiStore([s1, s2]);
    const keys = await multi.keys();
    expect(keys).toContain('k1');
    expect(keys).toContain('k2');
  });

  it('versions() returns union of versions across stores', async () => {
    const s1 = new MemoryStore();
    const s2 = new MemoryStore();
    await s1.set(entry('vk', '1.0.0'));
    await s2.set(entry('vk', '2.0.0'));
    const multi = new MultiStore([s1, s2]);
    const vers = await multi.versions('vk');
    expect(vers).toContain('1.0.0');
    expect(vers).toContain('2.0.0');
  });
});
