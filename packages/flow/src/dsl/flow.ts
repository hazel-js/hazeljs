/**
 * Fluent DSL builder for flow definitions
 */
import type {
  FlowDefinition,
  NodeDefinition,
  EdgeDefinition,
  FlowContext,
  NodeResult,
  RetryPolicy,
} from '../types/FlowTypes.js';

type NodeId = string;

export function flow(flowId: string, version: string) {
  const nodes: Record<NodeId, NodeDefinition> = {};
  const edges: EdgeDefinition[] = [];
  let entryNodeId: NodeId | null = null;

  return {
    entry(nodeId: NodeId) {
      entryNodeId = nodeId;
      return this;
    },

    node(
      nodeId: NodeId,
      handler: (ctx: FlowContext) => Promise<NodeResult>,
      options?: {
        name?: string;
        retry?: RetryPolicy;
        timeoutMs?: number;
        idempotencyKey?: (ctx: FlowContext) => string;
      }
    ) {
      nodes[nodeId] = {
        id: nodeId,
        name: options?.name,
        handler,
        retry: options?.retry,
        timeoutMs: options?.timeoutMs,
        idempotencyKey: options?.idempotencyKey,
      };
      return this;
    },

    edge(
      from: NodeId,
      to: NodeId,
      when?: (ctx: FlowContext) => boolean,
      priority?: number
    ) {
      edges.push({
        from,
        to,
        when,
        priority: priority ?? 0,
      });
      return this;
    },

    build(): FlowDefinition {
      if (!entryNodeId) {
        throw new Error('Flow must have an entry node. Call .entry(nodeId) first.');
      }
      return {
        flowId,
        version,
        entry: entryNodeId,
        nodes,
        edges,
      };
    },
  };
}
