import { describe, it, expect } from 'vitest';
import { Flow, Entry, Node, Edge, buildFlowDefinition } from '../src/decorators/flow.decorators.js';
import type { FlowContext, NodeResult } from '../src/types/FlowTypes.js';

@Flow('decorator-flow', '1.0.0')
class DecoratorFlow {
  @Entry()
  @Node('start')
  @Edge('end')
  async start(): Promise<NodeResult> {
    return { status: 'ok', output: { started: true } };
  }

  @Node('end')
  async end(): Promise<NodeResult> {
    return { status: 'ok', output: { done: true } };
  }
}

describe('buildFlowDefinition', () => {
  it('builds definition from decorated class', () => {
    const def = buildFlowDefinition(DecoratorFlow);
    expect(def.flowId).toBe('decorator-flow');
    expect(def.version).toBe('1.0.0');
    expect(def.entry).toBe('start');
    expect(Object.keys(def.nodes)).toContain('start');
    expect(Object.keys(def.nodes)).toContain('end');
    expect(def.edges).toHaveLength(1);
    expect(def.edges[0]).toMatchObject({ from: 'start', to: 'end' });
  });

  it('throws when class not decorated with @Flow', () => {
    class PlainClass {}
    expect(() => buildFlowDefinition(PlainClass)).toThrow('not decorated with @Flow');
  });

  it('throws when no @Entry node', () => {
    @Flow('no-entry-flow', '1.0.0')
    class NoEntryFlow {
      @Node('a')
      async a(): Promise<NodeResult> {
        return { status: 'ok', output: 1 };
      }
    }
    expect(() => buildFlowDefinition(NoEntryFlow)).toThrow('must have exactly one @Entry()');
  });

  it('supports @Node with options only (no nodeId string)', () => {
    @Flow('opts-flow', '1.0.0')
    class OptsFlow {
      @Entry()
      @Node({ name: 'StartNode' })
      @Edge('end')
      async start(): Promise<NodeResult> {
        return { status: 'ok', output: 1 };
      }

      @Node('end')
      async end(): Promise<NodeResult> {
        return { status: 'ok', output: 2 };
      }
    }
    const def = buildFlowDefinition(OptsFlow);
    expect(def.nodes.start?.name).toBe('StartNode');
  });
});
