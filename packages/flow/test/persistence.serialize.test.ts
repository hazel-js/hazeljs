import { describe, it, expect } from 'vitest';
import { toSerializable } from '../src/persistence/serialize.js';
import type { FlowDefinition } from '../src/types/FlowTypes.js';

describe('toSerializable', () => {
  it('strips handlers and when from definition', () => {
    const def: FlowDefinition = {
      flowId: 'f1',
      version: '1.0.0',
      entry: 'a',
      nodes: {
        a: {
          id: 'a',
          name: 'NodeA',
          handler: async () => ({ status: 'ok', output: 1 }),
          retry: { maxAttempts: 2, backoff: 'fixed', baseDelayMs: 100 },
          timeoutMs: 5000,
        },
      },
      edges: [
        { from: 'a', to: 'b', when: () => true, priority: 1 },
      ],
    };

    const result = toSerializable(def);
    expect(result.flowId).toBe('f1');
    expect(result.version).toBe('1.0.0');
    expect(result.entry).toBe('a');
    expect((result.nodes as Record<string, unknown>).a).toMatchObject({
      id: 'a',
      name: 'NodeA',
      retry: { maxAttempts: 2, backoff: 'fixed', baseDelayMs: 100 },
      timeoutMs: 5000,
    });
    expect((result.nodes as Record<string, unknown>).a).not.toHaveProperty('handler');
    expect(result.edges).toEqual([{ from: 'a', to: 'b', priority: 1 }]);
  });
});
