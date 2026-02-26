import { describe, it, expect } from 'vitest';
import { selectNextNode } from '../src/engine/Transition.js';
import type { FlowContext, EdgeDefinition } from '../src/types/FlowTypes.js';
import { AmbiguousEdgeError } from '../src/types/Errors.js';

function makeCtx(overrides?: Partial<FlowContext>): FlowContext {
  return {
    runId: 'r1',
    flowId: 'f1',
    flowVersion: '1.0.0',
    input: {},
    state: {},
    outputs: {},
    meta: { attempts: {}, startedAt: new Date().toISOString() },
    ...overrides,
  };
}

describe('selectNextNode', () => {
  it('returns null when no outgoing edges', () => {
    const edges: EdgeDefinition[] = [{ from: 'b', to: 'c', priority: 0 }];
    expect(selectNextNode('a', edges, makeCtx())).toBeNull();
  });

  it('returns null when no edges match when()', () => {
    const edges: EdgeDefinition[] = [
      { from: 'a', to: 'b', when: () => false, priority: 0 },
    ];
    expect(selectNextNode('a', edges, makeCtx())).toBeNull();
  });

  it('returns target when single edge matches', () => {
    const edges: EdgeDefinition[] = [{ from: 'a', to: 'b', priority: 0 }];
    expect(selectNextNode('a', edges, makeCtx())).toBe('b');
  });

  it('filters by when() - only matching edges considered', () => {
    const edges: EdgeDefinition[] = [
      { from: 'a', to: 'no', when: () => false, priority: 0 },
      { from: 'a', to: 'yes', when: (ctx) => (ctx.state as { ok?: boolean }).ok === true, priority: 0 },
    ];
    expect(selectNextNode('a', edges, makeCtx({ state: { ok: false } }))).toBeNull();
    expect(selectNextNode('a', edges, makeCtx({ state: { ok: true } }))).toBe('yes');
  });

  it('selects highest priority edge when multiple match', () => {
    const edges: EdgeDefinition[] = [
      { from: 'a', to: 'low', priority: 1 },
      { from: 'a', to: 'high', priority: 10 },
    ];
    expect(selectNextNode('a', edges, makeCtx())).toBe('high');
  });

  it('treats undefined priority as 0', () => {
    const edges: EdgeDefinition[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c', priority: 1 },
    ];
    expect(selectNextNode('a', edges, makeCtx())).toBe('c');
  });

  it('throws AmbiguousEdgeError when multiple edges have same top priority', () => {
    const edges: EdgeDefinition[] = [
      { from: 'a', to: 'b', when: () => true, priority: 5 },
      { from: 'a', to: 'c', when: () => true, priority: 5 },
    ];
    expect(() => selectNextNode('a', edges, makeCtx())).toThrow(/Ambiguous edge from node a/);
  });
});
