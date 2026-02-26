/**
 * JSONPath get/set tests
 */

import { get, set } from '../src';

describe('get', () => {
  it('gets top-level property', () => {
    expect(get({ a: 1 }, 'a')).toBe(1);
  });

  it('gets nested property', () => {
    expect(get({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing path', () => {
    expect(get({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined for null obj', () => {
    expect(get(null, 'a')).toBeUndefined();
  });

  it('handles array index', () => {
    expect(get({ arr: [10, 20, 30] }, 'arr[0]')).toBe(10);
    expect(get({ arr: [10, 20, 30] }, 'arr[2]')).toBe(30);
  });

  it('handles $. prefix', () => {
    expect(get({ x: 1 }, '$.x')).toBe(1);
  });
});

describe('set', () => {
  it('sets top-level property', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a', 1);
    expect(obj.a).toBe(1);
  });

  it('sets nested property', () => {
    const obj: Record<string, unknown> = {};
    set(obj, 'a.b.c', 42);
    expect(obj).toEqual({ a: { b: { c: 42 } } });
  });

  it('overwrites existing nested value', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } };
    set(obj, 'a.b', 99);
    expect((obj.a as Record<string, unknown>).b).toBe(99);
  });
});
