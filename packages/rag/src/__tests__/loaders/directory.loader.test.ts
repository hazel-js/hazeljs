jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

import { readdir, stat, readFile } from 'fs/promises';
import { DirectoryLoader } from '../../loaders/directory.loader';

const mockReaddir = readdir as jest.MockedFunction<typeof readdir>;
const mockStat = stat as jest.MockedFunction<typeof stat>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

function makeStat(isDir: boolean): Awaited<ReturnType<typeof stat>> {
  return { isDirectory: () => isDir } as Awaited<ReturnType<typeof stat>>;
}

describe('DirectoryLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads .txt files from a flat directory', async () => {
    mockReaddir.mockResolvedValueOnce(['notes.txt'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('file content' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].content).toBe('file content');
    expect(docs[0].metadata?.directoryPath).toBe('/tmp/docs');
  });

  it('recurses into subdirectories when recursive is true', async () => {
    mockReaddir
      .mockResolvedValueOnce(['subdir'] as never)
      .mockResolvedValueOnce(['doc.txt'] as never);
    mockStat
      .mockResolvedValueOnce(makeStat(true) as never)
      .mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('nested content' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', recursive: true });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
  });

  it('does not recurse when recursive is false', async () => {
    mockReaddir.mockResolvedValueOnce(['subdir'] as never);
    mockStat.mockResolvedValueOnce(makeStat(true) as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', recursive: false });
    const docs = await loader.load();
    expect(docs).toHaveLength(0);
  });

  it('skips hidden files/directories', async () => {
    mockReaddir.mockResolvedValueOnce(['.hidden', 'visible.txt'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('visible' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('visible');
  });

  it('respects includeExtensions filter', async () => {
    mockReaddir.mockResolvedValueOnce(['doc.txt', 'image.png'] as never);
    mockStat
      .mockResolvedValueOnce(makeStat(false) as never)
      .mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('text content' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', includeExtensions: ['.txt'] });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
  });

  it('respects excludeExtensions filter', async () => {
    mockReaddir.mockResolvedValueOnce(['doc.txt', 'data.json'] as never);
    mockStat
      .mockResolvedValueOnce(makeStat(false) as never)
      .mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('text' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', excludeExtensions: ['.json'] });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
  });

  it('stops at maxFiles limit', async () => {
    mockReaddir.mockResolvedValueOnce(['a.txt', 'b.txt', 'c.txt'] as never);
    mockStat
      .mockResolvedValueOnce(makeStat(false) as never)
      .mockResolvedValueOnce(makeStat(false) as never)
      .mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('a' as never).mockResolvedValueOnce('b' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', maxFiles: 2 });
    const docs = await loader.load();
    expect(docs.length).toBeLessThanOrEqual(2);
  });

  it('uses user-supplied loader factory', async () => {
    mockReaddir.mockResolvedValueOnce(['doc.txt'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);

    const fakeDocs = [{ content: 'custom', metadata: {} }];
    const factory = jest.fn().mockReturnValue({ load: jest.fn().mockResolvedValue(fakeDocs) });

    const loader = new DirectoryLoader({ path: '/tmp/docs', loaders: { '.txt': factory } });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('custom');
    expect(factory).toHaveBeenCalledWith(expect.stringContaining('doc.txt'));
  });

  it('auto-detects .md files', async () => {
    mockReaddir.mockResolvedValueOnce(['readme.md'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('# Hello' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
  });

  it('auto-detects .json files', async () => {
    mockReaddir.mockResolvedValueOnce(['data.json'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce(JSON.stringify([{ text: 'hello' }]) as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
  });

  it('auto-detects .csv files', async () => {
    mockReaddir.mockResolvedValueOnce(['data.csv'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('col\nval' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
  });

  it('auto-detects .html files', async () => {
    mockReaddir.mockResolvedValueOnce(['page.html'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('<p>hello</p>' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs.length).toBeGreaterThan(0);
  });

  it('skips files with unknown extensions gracefully', async () => {
    mockReaddir.mockResolvedValueOnce(['binary.exe'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs).toHaveLength(0);
  });

  it('skips files that throw errors during loading', async () => {
    mockReaddir.mockResolvedValueOnce(['bad.txt'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT') as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs' });
    const docs = await loader.load();
    expect(docs).toHaveLength(0);
  });

  it('merges extra metadata into documents', async () => {
    mockReaddir.mockResolvedValueOnce(['notes.txt'] as never);
    mockStat.mockResolvedValueOnce(makeStat(false) as never);
    mockReadFile.mockResolvedValueOnce('content' as never);

    const loader = new DirectoryLoader({ path: '/tmp/docs', metadata: { org: 'hazel' } });
    const docs = await loader.load();
    expect(docs[0].metadata?.org).toBe('hazel');
  });
});
