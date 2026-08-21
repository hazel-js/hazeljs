import {
  trimString,
  toLowerCase,
  toUpperCase,
  parseJson,
  stringifyJson,
  pick,
  omit,
  renameKeys,
  cast,
  parseDate,
  fillna,
  coalesce,
  flatten,
  explode,
  hash,
  dedupe,
  lookupJoin,
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
    it('converts non-string', () => {
      expect(toLowerCase(123)).toBe('123');
    });
  });

  describe('toUpperCase', () => {
    it('uppercases string', () => {
      expect(toUpperCase('hello')).toBe('HELLO');
    });
    it('converts non-string', () => {
      expect(toUpperCase(123)).toBe('123');
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
    it('returns empty for null', () => {
      expect(pick(['a'])(null)).toEqual({});
    });
    it('returns empty for non-object', () => {
      expect(pick(['a'])('string')).toEqual({});
    });
  });

  describe('omit', () => {
    it('omits specified keys', () => {
      const fn = omit(['b']);
      expect(fn({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
    });
    it('returns empty for null', () => {
      expect(omit(['a'])(null)).toEqual({});
    });
    it('returns empty for non-object', () => {
      expect(omit(['a'])(123)).toEqual({});
    });
  });

  describe('renameKeys', () => {
    it('renames keys', () => {
      const fn = renameKeys({ oldName: 'newName' });
      expect(fn({ oldName: 'value', keep: 1 })).toEqual({ newName: 'value', keep: 1 });
    });
    it('returns empty for null', () => {
      expect(renameKeys({ a: 'b' })(null)).toEqual({});
    });
    it('returns empty for non-object', () => {
      expect(renameKeys({ a: 'b' })(123)).toEqual({});
    });
    it('keeps keys not in mapping', () => {
      const fn = renameKeys({ a: 'A' });
      expect(fn({ a: 1, b: 2 })).toEqual({ A: 1, b: 2 });
    });
  });

  describe('cast', () => {
    it('casts fields to number/boolean/string/date', () => {
      const fn = cast({ age: 'number', active: 'boolean', name: 'string', when: 'date' });
      const result = fn({ age: '42', active: 'true', name: 1, when: '2020-01-15T00:00:00.000Z' });
      expect(result.age).toBe(42);
      expect(result.active).toBe(true);
      expect(result.name).toBe('1');
      expect(result.when).toBeInstanceOf(Date);
    });

    it('casts boolean variants and invalid values', () => {
      const fn = cast({ a: 'boolean', b: 'boolean', c: 'boolean', d: 'boolean', e: 'boolean' });
      expect(fn({ a: 'yes', b: '0', c: false, d: 2, e: { nested: true } })).toEqual({
        a: true,
        b: false,
        c: false,
        d: true,
        e: true,
      });
      expect(cast({ n: 'number' })({ n: 'x' }).n).toBe('x');
      const d = new Date('2020-01-01');
      expect(cast({ when: 'date' })({ when: d }).when).toBe(d);
      expect(cast({ when: 'date' })({ when: 'not-a-date' }).when).toBe('not-a-date');
    });
  });

  describe('parseDate', () => {
    it('parses date fields', () => {
      const result = parseDate(['createdAt'], { asIso: true })({
        createdAt: '2020-01-15T00:00:00.000Z',
      });
      expect(result.createdAt).toBe('2020-01-15T00:00:00.000Z');
    });
  });

  describe('fillna / coalesce', () => {
    it('fills null/undefined', () => {
      expect(fillna({ a: 0, b: 'x' })({ a: null, c: 1 })).toEqual({ a: 0, b: 'x', c: 1 });
      expect(coalesce({ a: 1 })({})).toEqual({ a: 1 });
    });
  });

  describe('flatten', () => {
    it('flattens nested objects', () => {
      expect(flatten()({ a: { b: 1 }, c: 2 })).toEqual({ 'a.b': 1, c: 2 });
    });
  });

  describe('explode', () => {
    it('explodes array field into rows', () => {
      expect(explode('tags')({ id: 1, tags: ['a', 'b'] })).toEqual([
        { id: 1, tags: 'a' },
        { id: 1, tags: 'b' },
      ]);
    });
    it('handles empty array and non-object', () => {
      expect(explode('tags')({ id: 1, tags: [] })).toEqual([{ id: 1, tags: undefined }]);
      expect(explode('tags')(null)).toEqual([]);
    });
  });

  describe('hash', () => {
    it('hashes field values', () => {
      const result = hash(['email'])({ email: 'a@b.com', name: 'x' });
      expect(result.email).toMatch(/^[a-f0-9]{64}$/);
      expect(result.name).toBe('x');
    });
  });

  describe('dedupe', () => {
    it('deduplicates by key fields', () => {
      const rows = dedupe(['id'])([
        { id: 1, v: 'a' },
        { id: 1, v: 'b' },
        { id: 2, v: 'c' },
      ]);
      expect(rows).toEqual([
        { id: 1, v: 'a' },
        { id: 2, v: 'c' },
      ]);
    });
  });

  describe('lookupJoin', () => {
    it('enriches from Map', () => {
      const map = new Map([['u1', { name: 'Ada' }]]);
      expect(lookupJoin('userId', map, 'user')({ userId: 'u1' })).toEqual({
        userId: 'u1',
        user: { name: 'Ada' },
      });
    });
    it('enriches from record table', () => {
      expect(lookupJoin('id', { a: 1 }, 'val')({ id: 'a' })).toEqual({ id: 'a', val: 1 });
    });
    it('keeps missing lookups when keepMissing is set', () => {
      expect(lookupJoin('id', { a: 1 }, 'val', { keepMissing: true })({ id: 'missing' })).toEqual({
        id: 'missing',
        val: null,
      });
      expect(lookupJoin('id', { a: 1 }, 'val')({ id: 'missing' })).toEqual({ id: 'missing' });
      expect(lookupJoin('id', { a: 1 }, 'val')(null)).toEqual({});
    });
  });

  describe('hash / dedupe / fillna edge cases', () => {
    it('hashes with prefix and skips null fields', () => {
      expect(hash(['email'], { prefix: 'h:' })({ email: 'a@b.com', other: null }).email).toMatch(
        /^h:[a-f0-9]{64}$/
      );
      expect(hash(['x'])(null)).toEqual({});
    });
    it('dedupe skips non-objects and non-arrays', () => {
      expect(dedupe(['id'])('x')).toEqual([]);
      expect(dedupe(['id'])([{ id: 1 }, null, { id: 1 }])).toEqual([{ id: 1 }]);
    });
  });
});
