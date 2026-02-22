/**
 * Edge transition logic - select next node from outgoing edges
 */
import type { FlowContext, EdgeDefinition } from '../types/FlowTypes.js';
import { AmbiguousEdgeError } from '../types/Errors.js';

export function selectNextNode(
  fromNodeId: string,
  edges: EdgeDefinition[],
  ctx: FlowContext
): string | null {
  const outgoing = edges.filter((e) => e.from === fromNodeId);
  if (outgoing.length === 0) return null;

  const matching = outgoing.filter((e) => !e.when || e.when(ctx));
  if (matching.length === 0) return null;

  const sorted = [...matching].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const topPriority = sorted[0]!.priority ?? 0;
  const atTop = sorted.filter((e) => (e.priority ?? 0) === topPriority);

  if (atTop.length > 1) {
    throw new AmbiguousEdgeError(fromNodeId);
  }
  return sorted[0]!.to;
}
