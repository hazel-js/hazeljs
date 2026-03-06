jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

import { readFile } from 'fs/promises';
import { HTMLFileLoader } from '../../loaders/html-file.loader';

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

const HTML_BASIC = `<html><head><title>My Page</title></head><body><p>Hello world</p></body></html>`;
const HTML_WITH_SCRIPT = `<html><body><script>var x=1;</script><p>Visible text</p><style>.hide{}</style></body></html>`;
const HTML_ENTITIES = `<p>&amp; &lt; &gt; &quot; &nbsp; &hellip; &#65;</p>`;
const HTML_MULTI_BLANK = `<p>Line 1</p>\n\n\n\n<p>Line 2</p>`;

describe('HTMLFileLoader', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws when no path is provided', () => {
    expect(() => new HTMLFileLoader({})).toThrow('provide at least one path');
  });

  it('loads HTML and strips tags', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_BASIC as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html' });
    const docs = await loader.load();
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain('Hello world');
    expect(docs[0].content).not.toContain('<p>');
    expect(docs[0].metadata?.loaderType).toBe('html');
    expect(docs[0].metadata?.source).toBe('page.html');
  });

  it('extracts title from <title> tag', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_BASIC as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html' });
    const docs = await loader.load();
    expect(docs[0].metadata?.title).toBe('My Page');
  });

  it('strips <script> and <style> blocks', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_WITH_SCRIPT as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html', stripScripts: true });
    const docs = await loader.load();
    expect(docs[0].content).not.toContain('var x=1');
    expect(docs[0].content).not.toContain('.hide');
    expect(docs[0].content).toContain('Visible text');
  });

  it('does not strip scripts when stripScripts is false', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_WITH_SCRIPT as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html', stripScripts: false });
    const docs = await loader.load();
    expect(docs[0].content).toContain('var x=1');
  });

  it('decodes HTML entities', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_ENTITIES as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html' });
    const docs = await loader.load();
    expect(docs[0].content).toContain('&');
    expect(docs[0].content).toContain('<');
    expect(docs[0].content).toContain('>');
    expect(docs[0].content).toContain('"');
    expect(docs[0].content).toContain('...');
    expect(docs[0].content).toContain('A'); // &#65;
  });

  it('collapses multiple blank lines', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_MULTI_BLANK as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html' });
    const docs = await loader.load();
    expect(docs[0].content).not.toMatch(/\n{3,}/);
  });

  it('loads multiple files', async () => {
    mockReadFile
      .mockResolvedValueOnce('<p>one</p>' as never)
      .mockResolvedValueOnce('<p>two</p>' as never);
    const loader = new HTMLFileLoader({ paths: ['/tmp/a.html', '/tmp/b.html'] });
    const docs = await loader.load();
    expect(docs).toHaveLength(2);
  });

  it('merges extra metadata', async () => {
    mockReadFile.mockResolvedValueOnce(HTML_BASIC as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html', metadata: { tag: 'v1' } });
    const docs = await loader.load();
    expect(docs[0].metadata?.tag).toBe('v1');
  });

  it('handles HTML without a title tag gracefully', async () => {
    mockReadFile.mockResolvedValueOnce('<p>no title here</p>' as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html' });
    const docs = await loader.load();
    expect(docs[0].metadata?.title).toBeUndefined();
  });

  it('does not collapse multiple blank lines when collapseWhitespace is false', async () => {
    mockReadFile.mockResolvedValueOnce('<p>line1</p>\n\n\n\n<p>line2</p>' as never);
    const loader = new HTMLFileLoader({ path: '/tmp/page.html', collapseWhitespace: false });
    const docs = await loader.load();
    // When collapseWhitespace is false, multiple blank lines are preserved
    expect(docs[0].content).toMatch(/\n{3,}/);
  });
});
