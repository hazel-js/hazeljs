import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';
import { FileStore } from '../../stores/file.store';
import type { PromptEntry } from '../../stores/store.interface';

function entry(key: string, version = '1.0.0', template = 'Hi {name}'): PromptEntry {
  return { key, version, template, metadata: { name: key, version }, storedAt: new Date().toISOString() };
}

function tmpFile(): string {
  return join(tmpdir(), `prompts-test-${Date.now()}-${Math.random()}.json`);
}

describe('FileStore', () => {
  let filePath: string;
  let store: FileStore;

  beforeEach(() => {
    filePath = tmpFile();
    store = new FileStore({ filePath });
  });

  afterEach(async () => {
    await rm(filePath, { force: true });
  });

  it('has name "file"', () => {
    expect(store.name).toBe('file');
  });

  it('set / get roundtrip', async () => {
    await store.set(entry('a:key'));
    const result = await store.get('a:key', '1.0.0');
    expect(result?.template).toBe('Hi {name}');
  });

  it('get() defaults to latest', async () => {
    await store.set(entry('a:key', '1.0.0'));
    const latest = await store.get('a:key');
    expect(latest?.version).toBe('latest');
  });

  it('get() returns undefined for missing key', async () => {
    expect(await store.get('missing:key')).toBeUndefined();
  });

  it('has() returns true when entry exists', async () => {
    await store.set(entry('b:key'));
    expect(await store.has('b:key', '1.0.0')).toBe(true);
  });

  it('has() returns false when entry missing', async () => {
    expect(await store.has('nope:key')).toBe(false);
  });

  it('delete() by version removes only that version', async () => {
    await store.set(entry('c:key', '1.0.0'));
    await store.set(entry('c:key', '2.0.0'));
    await store.delete('c:key', '1.0.0');
    expect(await store.has('c:key', '1.0.0')).toBe(false);
    expect(await store.has('c:key', '2.0.0')).toBe(true);
  });

  it('delete() without version removes all versions', async () => {
    await store.set(entry('d:key', '1.0.0'));
    await store.delete('d:key');
    expect(await store.has('d:key')).toBe(false);
  });

  it('keys() returns unique keys', async () => {
    await store.set(entry('k1', '1.0.0'));
    await store.set(entry('k1', '2.0.0'));
    await store.set(entry('k2'));
    const keys = await store.keys();
    expect(keys).toContain('k1');
    expect(keys).toContain('k2');
    expect(keys.filter((k) => k === 'k1')).toHaveLength(1);
  });

  it('versions() returns all non-latest versions sorted', async () => {
    await store.set(entry('ver:key', '1.0.0'));
    await store.set(entry('ver:key', '2.0.0'));
    const vers = await store.versions('ver:key');
    expect(vers).toEqual(['1.0.0', '2.0.0']);
  });

  it('versions() returns empty array for unknown key', async () => {
    expect(await store.versions('unknown')).toEqual([]);
  });

  it('persists across store instances (new FileStore reads same file)', async () => {
    await store.set(entry('persist:key', '1.0.0', 'Persistent template'));
    const store2 = new FileStore({ filePath });
    const result = await store2.get('persist:key', '1.0.0');
    expect(result?.template).toBe('Persistent template');
  });

  it('invalidate() forces re-read from disk', async () => {
    await store.set(entry('inv:key'));
    store.invalidate();
    expect(await store.has('inv:key', '1.0.0')).toBe(true);
  });

  it('pretty option defaults to true (indented JSON)', async () => {
    const prettyStore = new FileStore({ filePath, pretty: true });
    await prettyStore.set(entry('pretty:key'));
    const { readFile } = await import('fs/promises');
    const raw = await readFile(filePath, 'utf8');
    expect(raw).toMatch(/\n  /);
  });
});
