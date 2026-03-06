jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { MarkdownFileLoader } from '../../loaders/markdown-file.loader';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const MD_SIMPLE = `# Title\n\nSome content here.`;
const MD_WITH_FRONTMATTER = `---\ntitle: My Doc\nauthor: Alice\n---\n# Heading\n\nBody text.`;
const MD_H2_SPLIT = `## Section One\n\nContent one.\n\n## Section Two\n\nContent two.`;
const MD_H1_SPLIT = `# Chapter One\n\nText one.\n\n# Chapter Two\n\nText two.`;

describe('MarkdownFileLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws when no path is provided', () => {
    expect(() => new MarkdownFileLoader({})).toThrow('provide at least one path');
  });

  it('loads a single markdown file as one document', async () => {
    mockReadFile.mockResolvedValueOnce(MD_SIMPLE as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/readme.md' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].metadata?.source).toBe('readme.md');
    expect(docs[0].metadata?.loaderType).toBe('markdown');
    expect(docs[0].content).toContain('Some content');
  });

  it('parses YAML front-matter into metadata', async () => {
    mockReadFile.mockResolvedValueOnce(MD_WITH_FRONTMATTER as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md' });
    const docs = await loader.load();
    expect(docs[0].metadata?.title).toBe('My Doc');
    expect(docs[0].metadata?.author).toBe('Alice');
    expect(docs[0].content).not.toContain('---');
  });

  it('skips front-matter parsing when parseFrontMatter is false', async () => {
    mockReadFile.mockResolvedValueOnce(MD_WITH_FRONTMATTER as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md', parseFrontMatter: false });
    const docs = await loader.load();
    expect(docs[0].metadata?.title).toBeUndefined();
    expect(docs[0].content).toContain('---');
  });

  it('splits on h2 headings', async () => {
    mockReadFile.mockResolvedValueOnce(MD_H2_SPLIT as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md', splitByHeading: 'h2' });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].metadata?.heading).toBe('Section One');
    expect(docs[1].metadata?.heading).toBe('Section Two');
    expect(docs[0].content).toContain('Content one');
    expect(docs[1].content).toContain('Content two');
  });

  it('splits on h1 headings', async () => {
    mockReadFile.mockResolvedValueOnce(MD_H1_SPLIT as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md', splitByHeading: 'h1' });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].metadata?.heading).toBe('Chapter One');
  });

  it('loads multiple files', async () => {
    mockReadFile
      .mockResolvedValueOnce('file one content' as never)
      .mockResolvedValueOnce('file two content' as never);
    const loader = new MarkdownFileLoader({ paths: ['/tmp/a.md', '/tmp/b.md'] });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
    expect(docs[0].metadata?.source).toBe('a.md');
    expect(docs[1].metadata?.source).toBe('b.md');
  });

  it('merges extra metadata', async () => {
    mockReadFile.mockResolvedValueOnce(MD_SIMPLE as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md', metadata: { env: 'test' } });
    const docs = await loader.load();
    expect(docs[0].metadata?.env).toBe('test');
  });

  it('handles front-matter with quoted values', async () => {
    const md = `---\ntitle: "Quoted Title"\n---\nContent`;
    mockReadFile.mockResolvedValueOnce(md as never);
    const loader = new MarkdownFileLoader({ path: '/tmp/doc.md' });
    const docs = await loader.load();
    expect(docs[0].metadata?.title).toBe('Quoted Title');
  });
});
