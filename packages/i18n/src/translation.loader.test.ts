import { TranslationLoader } from './translation.loader';

jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { readdirSync, readFileSync } from 'fs';

const mockReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('TranslationLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('load()', () => {
    it('returns an empty store when directory does not exist', () => {
      mockReaddirSync.mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      const store = TranslationLoader.load('/nonexistent/path');
      expect(store.size).toBe(0);
    });

    it('returns an empty store when directory is empty', () => {
      mockReaddirSync.mockReturnValue([] as never);

      const store = TranslationLoader.load('/empty/dir');
      expect(store.size).toBe(0);
    });

    it('ignores non-JSON files', () => {
      mockReaddirSync.mockReturnValue(['README.md', 'notes.txt'] as never);

      const store = TranslationLoader.load('/some/dir');
      expect(store.size).toBe(0);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('loads a single JSON file and stores translations by locale', () => {
      mockReaddirSync.mockReturnValue(['en.json'] as never);
      mockReadFileSync.mockReturnValue('{"hello":"Hello","bye":"Goodbye"}' as never);

      const store = TranslationLoader.load('/translations');
      expect(store.has('en')).toBe(true);
      expect(store.get('en')).toEqual({ hello: 'Hello', bye: 'Goodbye' });
    });

    it('loads multiple JSON files into separate locale entries', () => {
      mockReaddirSync.mockReturnValue(['en.json', 'fr.json'] as never);
      mockReadFileSync
        .mockReturnValueOnce('{"hello":"Hello"}' as never)
        .mockReturnValueOnce('{"hello":"Bonjour"}' as never);

      const store = TranslationLoader.load('/translations');
      expect(store.size).toBe(2);
      expect(store.get('en')).toEqual({ hello: 'Hello' });
      expect(store.get('fr')).toEqual({ hello: 'Bonjour' });
    });

    it('handles locale codes with hyphens (zh-TW.json)', () => {
      mockReaddirSync.mockReturnValue(['zh-TW.json'] as never);
      mockReadFileSync.mockReturnValue('{"greeting":"你好"}' as never);

      const store = TranslationLoader.load('/translations');
      expect(store.has('zh-TW')).toBe(true);
    });

    it('skips malformed JSON files and writes to stderr', () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mockReaddirSync.mockReturnValue(['en.json', 'bad.json'] as never);
      mockReadFileSync
        .mockReturnValueOnce('{"ok":true}' as never)
        .mockReturnValueOnce('{ invalid json' as never);

      const store = TranslationLoader.load('/translations');
      expect(store.has('en')).toBe(true);
      expect(store.has('bad')).toBe(false);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[@hazeljs/i18n]'));

      stderrSpy.mockRestore();
    });

    it('writes non-Error exception to stderr as string', () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mockReaddirSync.mockReturnValue(['broken.json'] as never);
      mockReadFileSync.mockImplementation(() => {
        throw 'string error';
      });

      const store = TranslationLoader.load('/translations');
      expect(store.has('broken')).toBe(false);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('string error'));

      stderrSpy.mockRestore();
    });

    it('loads nested translation objects', () => {
      mockReaddirSync.mockReturnValue(['en.json'] as never);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ errors: { notFound: 'Not found', invalid: 'Invalid' } }) as never
      );

      const store = TranslationLoader.load('/translations');
      expect(store.get('en')).toEqual({
        errors: { notFound: 'Not found', invalid: 'Invalid' },
      });
    });
  });
});
