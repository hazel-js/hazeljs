jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { CSVFileLoader } from '../../loaders/csv-file.loader';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const CSV_BASIC = `name,age,city\nAlice,30,NYC\nBob,25,LA`;
const CSV_QUOTED = `name,description\nAlice,"loves cats, dogs"\nBob,"says ""hello""!"`;
const CSV_NO_HEADER = `Alice,30\nBob,25`;
const CSV_EMPTY = ``;

describe('CSVFileLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads CSV with header, one doc per row', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_BASIC as never);
    const loader = new CSVFileLoader({ path: '/tmp/data.csv' });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toContain('Alice');
    expect(docs[0].metadata?.loaderType).toBe('csv');
    expect(docs[0].metadata?.source).toBe('data.csv');
    expect(docs[0].metadata?.row).toBe(0);
  });

  it('uses contentColumns to build content', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_BASIC as never);
    const loader = new CSVFileLoader({
      path: '/tmp/data.csv',
      contentColumns: ['name'],
      metadataColumns: ['age', 'city'],
    });
    const docs = await loader.load();
    expect(docs[0].content).toBe('Alice');
    expect(docs[0].metadata?.age).toBe('30');
    expect(docs[0].metadata?.city).toBe('NYC');
  });

  it('uses multiple contentColumns with key:value format', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_BASIC as never);
    const loader = new CSVFileLoader({
      path: '/tmp/data.csv',
      contentColumns: ['name', 'city'],
    });
    const docs = await loader.load();
    expect(docs[0].content).toContain('name: Alice');
    expect(docs[0].content).toContain('city: NYC');
  });

  it('handles quoted fields with embedded commas', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_QUOTED as never);
    const loader = new CSVFileLoader({ path: '/tmp/data.csv', contentColumns: ['description'] });
    const docs = await loader.load();
    expect(docs[0].content).toBe('loves cats, dogs');
  });

  it('handles escaped quotes inside quoted fields', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_QUOTED as never);
    const loader = new CSVFileLoader({ path: '/tmp/data.csv', contentColumns: ['description'] });
    const docs = await loader.load();
    expect(docs[1].content).toContain('"hello"');
  });

  it('handles CSV without header row', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_NO_HEADER as never);
    const loader = new CSVFileLoader({ path: '/tmp/data.csv', hasHeader: false });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toContain('col0');
  });

  it('returns empty array for empty CSV', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_EMPTY as never);
    const loader = new CSVFileLoader({ path: '/tmp/empty.csv' });
    const docs = await loader.load();
    expect(docs).toHaveLength(0);
  });

  it('merges extra metadata', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_BASIC as never);
    const loader = new CSVFileLoader({
      path: '/tmp/data.csv',
      metadata: { project: 'test' },
    });
    const docs = await loader.load();
    expect(docs[0].metadata?.project).toBe('test');
  });

  it('uses custom delimiter', async () => {
    mockReadFile.mockResolvedValueOnce('a|b|c\n1|2|3' as never);
    const loader = new CSVFileLoader({ path: '/tmp/data.csv', delimiter: '|' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
  });

  it('uses custom content separator', async () => {
    mockReadFile.mockResolvedValueOnce(CSV_BASIC as never);
    const loader = new CSVFileLoader({
      path: '/tmp/data.csv',
      contentColumns: ['name', 'city'],
      contentSeparator: ' | ',
    });
    const docs = await loader.load();
    expect(docs[0].content).toContain(' | ');
  });
});
