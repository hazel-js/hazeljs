jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { TextFileLoader } from '../../loaders/text-file.loader';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('TextFileLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws when no path is provided', () => {
    expect(() => new TextFileLoader({})).toThrow('provide at least one file path');
  });

  it('loads a single file', async () => {
    mockReadFile.mockResolvedValueOnce('hello world' as never);
    const loader = new TextFileLoader({ path: '/tmp/notes.txt' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('hello world');
    expect(docs[0].metadata?.source).toBe('notes.txt');
    expect(docs[0].metadata?.loaderType).toBe('text');
    expect(docs[0].metadata?.filePath).toBe('/tmp/notes.txt');
  });

  it('loads multiple files', async () => {
    mockReadFile
      .mockResolvedValueOnce('file one' as never)
      .mockResolvedValueOnce('file two' as never);
    const loader = new TextFileLoader({ paths: ['/tmp/a.txt', '/tmp/b.txt'] });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe('file one');
    expect(docs[1].content).toBe('file two');
  });

  it('merges extra metadata into each document', async () => {
    mockReadFile.mockResolvedValueOnce('content' as never);
    const loader = new TextFileLoader({
      path: '/tmp/doc.txt',
      metadata: { project: 'hazeljs' },
    });
    const docs = await loader.load();
    expect(docs[0].metadata?.project).toBe('hazeljs');
  });

  it('trims whitespace from content', async () => {
    mockReadFile.mockResolvedValueOnce('  trimmed  ' as never);
    const loader = new TextFileLoader({ path: '/tmp/f.txt' });
    const docs = await loader.load();
    expect(docs[0].content).toBe('trimmed');
  });
});
