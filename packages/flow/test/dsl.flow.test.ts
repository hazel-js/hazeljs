import { describe, it, expect } from 'vitest';
import { flow } from '../src/dsl/flow.js';

describe('flow DSL', () => {
  it('builds a flow definition with entry, node, edge', () => {
    const def = flow('test-flow', '1.0.0')
      .entry('a')
      .node('a', async () => ({ status: 'ok', output: 1 }))
      .edge('a', 'b')
      .node('b', async () => ({ status: 'ok', output: 2 }))
      .build();

    expect(def.flowId).toBe('test-flow');
    expect(def.version).toBe('1.0.0');
    expect(def.entry).toBe('a');
    expect(Object.keys(def.nodes)).toEqual(['a', 'b']);
    expect(def.edges).toHaveLength(1);
    expect(def.edges[0]).toEqual({ from: 'a', to: 'b', priority: 0 });
  });

  it('throws when build() called without entry', () => {
    expect(() =>
      flow('x', '1.0.0')
        .node('a', async () => ({ status: 'ok', output: 1 }))
        .build()
    ).toThrow('Flow must have an entry node');
  });

  it('supports node options (name, retry, timeoutMs, idempotencyKey)', () => {
    const idempotencyKey = (): string => 'key';
    const def = flow('opt-flow', '1.0.0')
      .entry('a')
      .node('a', async () => ({ status: 'ok', output: 1 }), {
        name: 'NodeA',
        retry: { maxAttempts: 3, backoff: 'exponential', baseDelayMs: 100 },
        timeoutMs: 5000,
        idempotencyKey,
      })
      .build();

    expect(def.nodes.a?.name).toBe('NodeA');
    expect(def.nodes.a?.retry).toEqual({ maxAttempts: 3, backoff: 'exponential', baseDelayMs: 100 });
    expect(def.nodes.a?.timeoutMs).toBe(5000);
    expect(def.nodes.a?.idempotencyKey).toBe(idempotencyKey);
  });

  it('supports edge with when and priority', () => {
    const when = (): boolean => true;
    const def = flow('edge-flow', '1.0.0')
      .entry('a')
      .node('a', async () => ({ status: 'ok', output: 1 }))
      .edge('a', 'b', when, 10)
      .node('b', async () => ({ status: 'ok', output: 2 }))
      .build();

    expect(def.edges[0]).toEqual({ from: 'a', to: 'b', when, priority: 10 });
  });
});
