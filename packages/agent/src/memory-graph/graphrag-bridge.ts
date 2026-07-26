/**
 * Bridge AgentMemoryGraph ↔ @hazeljs/rag KnowledgeGraph (GraphRAG).
 */

import { AgentMemoryGraph, type MemoryGraphEdge, type MemoryGraphNode } from '../memory-graph/memory-graph';

/** Minimal KnowledgeGraph shape from @hazeljs/rag (avoid hard compile dep on rag types). */
export interface KnowledgeGraphLike {
  entities: Map<string, { id: string; name: string; type: string; description?: string; metadata?: Record<string, unknown> }>;
  relationships: Map<
    string,
    { id: string; sourceId: string; targetId: string; type: string; weight?: number; metadata?: Record<string, unknown> }
  >;
  addEntity?(entity: {
    id: string;
    name: string;
    type: string;
    description: string;
    sourceDocIds: string[];
    metadata?: Record<string, unknown>;
  }): unknown;
  addRelationship?(rel: {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    weight?: number;
    description?: string;
    sourceDocIds?: string[];
    metadata?: Record<string, unknown>;
  }): unknown;
}

export function memoryGraphFromKnowledgeGraph(
  kg: KnowledgeGraphLike,
  opts?: { domain?: string }
): AgentMemoryGraph {
  const g = new AgentMemoryGraph();
  for (const e of kg.entities.values()) {
    g.upsertNode({
      id: e.id,
      type: e.type,
      label: e.name,
      attributes: { description: e.description, ...(e.metadata ?? {}) },
      domain: opts?.domain ?? 'graphrag',
    });
  }
  for (const r of kg.relationships.values()) {
    try {
      g.link({
        id: r.id,
        from: r.sourceId,
        to: r.targetId,
        relation: r.type,
        weight: r.weight,
        attributes: r.metadata,
      });
    } catch {
      // skip edges whose endpoints were filtered out
    }
  }
  return g;
}

/** Push AgentMemoryGraph nodes/edges into a GraphRAG KnowledgeGraph. */
export function syncMemoryGraphToKnowledgeGraph(
  graph: AgentMemoryGraph,
  kg: KnowledgeGraphLike
): { nodes: number; edges: number } {
  const data = graph.toJSON();
  let nodes = 0;
  let edges = 0;

  for (const n of data.nodes) {
    if (kg.addEntity) {
      kg.addEntity({
        id: n.id,
        name: n.label,
        type: n.type,
        description: String(n.attributes.description ?? n.label),
        sourceDocIds: [],
        metadata: { ...n.attributes, domain: n.domain },
      });
      nodes += 1;
    }
  }

  for (const e of data.edges) {
    if (kg.addRelationship) {
      kg.addRelationship({
        id: e.id,
        sourceId: e.from,
        targetId: e.to,
        type: e.relation,
        weight: e.weight,
        metadata: e.attributes,
        sourceDocIds: [],
      });
      edges += 1;
    }
  }

  return { nodes, edges };
}

export type { MemoryGraphNode, MemoryGraphEdge };
