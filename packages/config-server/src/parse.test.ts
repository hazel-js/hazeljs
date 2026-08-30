import { parseConfigContent, parseProperties } from './parse';
import { deepMerge, getNested, setNested } from './merge';

describe('parseProperties', () => {
  it('parses dotted keys and types', () => {
    const parsed = parseProperties(`
# comment
database.url = postgres://localhost/app
database.port = 5432
features.newAlgorithm = true
empty
flag: false
`);
    expect(parsed).toEqual({
      database: { url: 'postgres://localhost/app', port: 5432 },
      features: { newAlgorithm: true },
      flag: false,
    });
  });
});

describe('parseConfigContent', () => {
  it('parses JSON objects', () => {
    expect(parseConfigContent('{"a":1}', 'app.json')).toEqual({ a: 1 });
  });

  it('rejects JSON arrays', () => {
    expect(() => parseConfigContent('[]', 'app.json')).toThrow(/JSON object/);
  });

  it('parses YAML mappings', () => {
    const parsed = parseConfigContent('database:\n  host: db\n  port: 5432\n', 'app.yml');
    expect(parsed).toEqual({ database: { host: 'db', port: 5432 } });
  });

  it('returns empty object for empty YAML', () => {
    expect(parseConfigContent('', 'app.yaml')).toEqual({});
  });

  it('rejects YAML arrays', () => {
    expect(() => parseConfigContent('- a\n', 'app.yml')).toThrow(/YAML mapping/);
  });

  it('parses .env files', () => {
    expect(parseConfigContent('PORT=8080\n', 'app.env')).toEqual({ PORT: 8080 });
  });

  it('rejects unknown extensions', () => {
    expect(() => parseConfigContent('x', 'app.txt')).toThrow(/Unsupported/);
  });
});

describe('merge helpers', () => {
  it('deep-merges objects and overrides leaves', () => {
    const merged = deepMerge({ a: { b: 1, c: 2 }, d: 3 }, { a: { c: 9 }, e: 4 });
    expect(merged).toEqual({ a: { b: 1, c: 9 }, d: 3, e: 4 });
  });

  it('gets and sets nested paths', () => {
    const obj: Record<string, unknown> = {};
    setNested(obj, 'database.url', 'postgres://x');
    expect(getNested(obj, 'database.url')).toBe('postgres://x');
    expect(getNested(obj, 'database.missing')).toBeUndefined();
    expect(getNested(obj, 'nope')).toBeUndefined();
  });
});
