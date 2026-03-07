/**
 * Serialize flow definition for DB storage (strips functions)
 */
import type { FlowDefinition } from '../types/FlowTypes.js';

export function toSerializable(def: FlowDefinition): Record<string, unknown> {
  const nodes: Record<string, unknown> = {};
  for (const [id, node] of Object.entries(def.nodes)) {
    nodes[id] = {
      id: node.id,
      name: node.name,
      retry: node.retry,
      timeoutMs: node.timeoutMs,
      // handler, idempotencyKey are not serializable - omitted
    };
  }
  const edges = def.edges.map((e) => ({
    from: e.from,
    to: e.to,
    priority: e.priority,
    // when is a function - omitted
  }));
  return {
    flowId: def.flowId,
    version: def.version,
    entry: def.entry,
    nodes,
    edges,
  };
}
