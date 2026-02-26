import { describe, it, expect } from 'vitest';
import { deepMerge } from '../src/engine/utils.js';

describe('deepMerge', () => {
  it('merges shallow properties', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 20, c: 3 };
    expect(deepMerge(target, source)).toEqual({ a: 1, b: 20, c: 3 });
  });

  it('deep merges nested objects', () => {
    const target = { a: { x: 1, y: 2 } };
    const source = { a: { y: 20, z: 3 } };
    expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 20, z: 3 } });
  });

  it('overwrites with non-object source values', () => {
    const target = { a: { x: 1 } };
    const source = { a: 42 };
    expect(deepMerge(target, source)).toEqual({ a: 42 });
  });
});
