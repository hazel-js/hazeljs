/**
 * Template resolver tests
 */

import { resolveTemplate, resolveTemplateDeep } from '../src';

describe('resolveTemplate', () => {
  it('resolves single placeholder', () => {
    const state = { answers: { name: 'Alice' } } as Record<string, unknown>;
    expect(resolveTemplate('Hello {{answers.name}}', state)).toBe('Hello Alice');
  });

  it('resolves multiple placeholders', () => {
    const state = { a: 'x', b: 'y' } as Record<string, unknown>;
    expect(resolveTemplate('{{a}}-{{b}}', state)).toBe('x-y');
  });

  it('replaces missing value with empty string', () => {
    const state = {} as Record<string, unknown>;
    expect(resolveTemplate('{{missing}}', state)).toBe('');
  });
});

describe('resolveTemplateDeep', () => {
  it('resolves string', () => {
    const state = { answers: { x: 1 } } as Record<string, unknown>;
    expect(resolveTemplateDeep('{{answers.x}}', state)).toBe('1');
  });

  it('resolves object recursively', () => {
    const state = { answers: { name: 'Bob' } } as Record<string, unknown>;
    const body = { greeting: 'Hi {{answers.name}}' };
    expect(resolveTemplateDeep(body, state)).toEqual({ greeting: 'Hi Bob' });
  });

  it('passes through null/undefined', () => {
    expect(resolveTemplateDeep(null, {})).toBeNull();
    expect(resolveTemplateDeep(undefined, {})).toBeUndefined();
  });

  it('resolves array items', () => {
    const state = { x: 'val' } as Record<string, unknown>;
    expect(resolveTemplateDeep(['{{x}}', 'static'], state)).toEqual(['val', 'static']);
  });
});
