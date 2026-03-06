import { RecursiveTextSplitter } from '../../text-splitters/recursive-text-splitter';

describe('RecursiveTextSplitter', () => {
  describe('split', () => {
    it('returns the whole text when it fits in one chunk', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 1000, chunkOverlap: 0 });
      const result = splitter.split('hello world');
      expect(result).toEqual(['hello world']);
    });

    it('splits on double newlines first', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 20, chunkOverlap: 0 });
      const text = 'paragraph one here\n\nparagraph two here';
      const result = splitter.split(text);
      expect(result.length).toBeGreaterThan(1);
    });

    it('splits on single newlines when paragraphs are too big', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 15, chunkOverlap: 0 });
      const text = 'line one\nline two\nline three';
      const result = splitter.split(text);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('splits long text into multiple chunks', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 10, chunkOverlap: 0 });
      const text = 'word1 word2 word3 word4 word5 word6';
      const result = splitter.split(text);
      expect(result.length).toBeGreaterThan(1);
    });

    it('respects custom separators', () => {
      const splitter = new RecursiveTextSplitter({
        chunkSize: 20,
        chunkOverlap: 0,
        separators: ['|'],
      });
      const text = 'part1|part2|part3|part4|part5';
      const result = splitter.split(text);
      expect(result.length).toBeGreaterThan(1);
    });

    it('adds overlap between chunks', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 20, chunkOverlap: 5 });
      const text = 'first second third fourth fifth sixth seventh eighth';
      const result = splitter.split(text);
      if (result.length > 1) {
        // second chunk should start with tail of first chunk
        const firstEnd = result[0].slice(-5);
        expect(result[1].startsWith(firstEnd)).toBe(true);
      }
    });

    it('no overlap when chunkOverlap is 0', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 10, chunkOverlap: 0 });
      const text = 'word1 word2 word3 word4 word5';
      const result = splitter.split(text);
      // With 0 overlap, splitting result should still be valid
      expect(result.every((c) => c.length > 0)).toBe(true);
    });
  });

  describe('splitDocuments', () => {
    it('splits each document and preserves metadata', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 20, chunkOverlap: 0 });
      const docs = [
        {
          content: 'first paragraph here\n\nsecond paragraph here',
          metadata: { source: 'test.txt' },
        },
      ];
      const result = splitter.splitDocuments(docs);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].metadata?.source).toBe('test.txt');
      expect(result[0].metadata?.chunkIndex).toBe(0);
      expect(result[0].metadata?.totalChunks).toBeGreaterThan(0);
    });

    it('handles multiple documents', () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 100, chunkOverlap: 0 });
      const docs = [
        { id: 'doc1', content: 'short text', metadata: {} },
        { id: 'doc2', content: 'another short text', metadata: {} },
      ];
      const result = splitter.splitDocuments(docs);
      expect(result.length).toBe(2);
      expect(result[0].metadata?.sourceDocId).toBe('doc1');
      expect(result[1].metadata?.sourceDocId).toBe('doc2');
    });

    it('returns empty array for empty input', () => {
      const splitter = new RecursiveTextSplitter();
      expect(splitter.splitDocuments([])).toEqual([]);
    });
  });

  describe('default config', () => {
    it('uses default chunkSize of 1000', () => {
      const splitter = new RecursiveTextSplitter();
      const text = 'a'.repeat(500);
      const result = splitter.split(text);
      expect(result).toHaveLength(1);
    });
  });
});
