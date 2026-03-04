import { TranslationLoader } from './translation.loader';

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

import { readdir, readFile } from 'fs/promises';

const mockReaddir = readdir as jest.MockedFunction<typeof readdir>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('TranslationLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('load()', () => {
    it('returns an empty store when directory does not exist', async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const store = await TranslationLoader.load('/nonexistent/path');
      expect(store.size).toBe(0);
    });

    it('returns an empty store when directory is empty', async () => {
      mockReaddir.mockResolvedValue([] as never);

      const store = await TranslationLoader.load('/empty/dir');
      expect(store.size).toBe(0);
    });

    it('ignores non-JSON files', async () => {
      mockReaddir.mockResolvedValue(['README.md', 'notes.txt'] as never);

      const store = await TranslationLoader.load('/some/dir');
      expect(store.size).toBe(0);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('loads a single JSON file and stores translations by locale', async () => {
      mockReaddir.mockResolvedValue(['en.json'] as never);
      mockReadFile.mockResolvedValue('{"hello":"Hello","bye":"Goodbye"}' as never);

      const store = await TranslationLoader.load('/translations');
      expect(store.has('en')).toBe(true);
      expect(store.get('en')).toEqual({ hello: 'Hello', bye: 'Goodbye' });
    });

    it('loads multiple JSON files into separate locale entries', async () => {
      mockReaddir.mockResolvedValue(['en.json', 'fr.json'] as never);
      mockReadFile
        .mockResolvedValueOnce('{"hello":"Hello"}' as never)
        .mockResolvedValueOnce('{"hello":"Bonjour"}' as never);

      const store = await TranslationLoader.load('/translations');
      expect(store.size).toBe(2);
      expect(store.get('en')).toEqual({ hello: 'Hello' });
      expect(store.get('fr')).toEqual({ hello: 'Bonjour' });
    });

    it('handles locale codes with hyphens (zh-TW.json)', async () => {
      mockReaddir.mockResolvedValue(['zh-TW.json'] as never);
      mockReadFile.mockResolvedValue('{"greeting":"你好"}' as never);

      const store = await TranslationLoader.load('/translations');
      expect(store.has('zh-TW')).toBe(true);
    });

    it('skips malformed JSON files and writes to stderr', async () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mockReaddir.mockResolvedValue(['en.json', 'bad.json'] as never);
      mockReadFile
        .mockResolvedValueOnce('{"ok":true}' as never)
        .mockResolvedValueOnce('{ invalid json' as never);

      const store = await TranslationLoader.load('/translations');
      expect(store.has('en')).toBe(true);
      expect(store.has('bad')).toBe(false);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[@hazeljs/i18n]'));

      stderrSpy.mockRestore();
    });

    it('writes non-Error exception to stderr as string', async () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mockReaddir.mockResolvedValue(['broken.json'] as never);
      mockReadFile.mockRejectedValue('string error' as never);

      const store = await TranslationLoader.load('/translations');
      expect(store.has('broken')).toBe(false);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('string error'));

      stderrSpy.mockRestore();
    });

    it('loads nested translation objects', async () => {
      mockReaddir.mockResolvedValue(['en.json'] as never);
      mockReadFile.mockResolvedValue(
        JSON.stringify({ errors: { notFound: 'Not found', invalid: 'Invalid' } }) as never
      );

      const store = await TranslationLoader.load('/translations');
      expect(store.get('en')).toEqual({
        errors: { notFound: 'Not found', invalid: 'Invalid' },
      });
    });
  });
});
