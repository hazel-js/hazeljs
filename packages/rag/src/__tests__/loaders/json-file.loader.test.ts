jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { JSONFileLoader } from '../../loaders/json-file.loader';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('JSONFileLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads an array JSON file — one doc per element', async () => {
    const data = JSON.stringify([
      { title: 'A', body: 'Text A' },
      { title: 'B', body: 'Text B' },
    ]);
    mockReadFile.mockResolvedValueOnce(data as never);
    const loader = new JSONFileLoader({ path: '/tmp/items.json', textKey: 'body' });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe('Text A');
    expect(docs[0].metadata?.source).toBe('items.json');
    expect(docs[0].metadata?.loaderType).toBe('json');
    expect(docs[0].metadata?.index).toBe(0);
  });

  it('loads a single root object as one document', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ message: 'hello' }) as never);
    const loader = new JSONFileLoader({ path: '/tmp/obj.json', textKey: 'message' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('hello');
  });

  it('stringifies element when textKey is absent', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify([{ key: 'val' }]) as never);
    const loader = new JSONFileLoader({ path: '/tmp/items.json' });
    const docs = await loader.load();
    expect(docs[0].content).toContain('"key"');
  });

  it('extracts metadataKeys into metadata', async () => {
    const data = JSON.stringify([{ id: '1', title: 'My Title', body: 'content' }]);
    mockReadFile.mockResolvedValueOnce(data as never);
    const loader = new JSONFileLoader({
      path: '/tmp/items.json',
      textKey: 'body',
      metadataKeys: ['id', 'title'],
    });
    const docs = await loader.load();
    expect(docs[0].metadata?.id).toBe('1');
    expect(docs[0].metadata?.title).toBe('My Title');
  });

  it('navigates nested arrays via jsonPointer', async () => {
    const data = JSON.stringify({ data: { results: [{ text: 'nested' }] } });
    mockReadFile.mockResolvedValueOnce(data as never);
    const loader = new JSONFileLoader({
      path: '/tmp/data.json',
      textKey: 'text',
      jsonPointer: 'data.results',
    });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('nested');
  });

  it('throws when jsonPointer key is not found', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ foo: 'bar' }) as never);
    const loader = new JSONFileLoader({ path: '/tmp/data.json', jsonPointer: 'missing.key' });
    await expect(loader.load()).rejects.toThrow('not found');
  });

  it('merges extra metadata', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify([{ text: 'hi' }]) as never);
    const loader = new JSONFileLoader({
      path: '/tmp/data.json',
      textKey: 'text',
      metadata: { env: 'prod' },
    });
    const docs = await loader.load();
    expect(docs[0].metadata?.env).toBe('prod');
  });

  it('stringifies non-object primitives in array', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify(['hello', 'world']) as never);
    const loader = new JSONFileLoader({ path: '/tmp/data.json' });
    const docs = await loader.load();
    expect(docs[0].content).toContain('hello');
  });
});
