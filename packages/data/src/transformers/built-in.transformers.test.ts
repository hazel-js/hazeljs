import {
  trimString,
  toLowerCase,
  toUpperCase,
  parseJson,
  stringifyJson,
  pick,
  omit,
  renameKeys,
} from './built-in.transformers';

describe('built-in transformers', () => {
  describe('trimString', () => {
    it('trims whitespace', () => {
      expect(trimString('  hi  ')).toBe('hi');
    });
    it('converts non-string', () => {
      expect(trimString(123)).toBe('123');
    });
  });

  describe('toLowerCase', () => {
    it('lowercases string', () => {
      expect(toLowerCase('HELLO')).toBe('hello');
    });
  });

  describe('toUpperCase', () => {
    it('uppercases string', () => {
      expect(toUpperCase('hello')).toBe('HELLO');
    });
  });

  describe('parseJson', () => {
    it('parses JSON string', () => {
      expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    });
    it('returns value for non-string', () => {
      expect(parseJson({ a: 1 })).toEqual({ a: 1 });
    });
  });

  describe('stringifyJson', () => {
    it('stringifies object', () => {
      expect(stringifyJson({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('pick', () => {
    it('picks specified keys', () => {
      const fn = pick(['a', 'c']);
      expect(fn({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
    });
    it('handles missing keys', () => {
      expect(pick(['x'])({})).toEqual({});
    });
  });

  describe('omit', () => {
    it('omits specified keys', () => {
      const fn = omit(['b']);
      expect(fn({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
    });
  });

  describe('renameKeys', () => {
    it('renames keys', () => {
      const fn = renameKeys({ oldName: 'newName' });
      expect(fn({ oldName: 'value', keep: 1 })).toEqual({ newName: 'value', keep: 1 });
    });
  });
});
