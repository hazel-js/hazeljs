/**
 * Agent OS Phase 3 — Memory Graph (cross-domain entity/relation store)
 * Product API that can later back onto GraphRAG; in-memory by default.
 */

import { randomUUID } from 'crypto';

export interface MemoryGraphNode {
  id: string;
  type: string;
  label: string;
  attributes: Record<string, unknown>;
  domain?: string;
  updatedAt: string;
}

export interface MemoryGraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
  weight?: number;
  attributes?: Record<string, unknown>;
}

export class AgentMemoryGraph {
  private nodes = new Map<string, MemoryGraphNode>();
  private edges = new Map<string, MemoryGraphEdge>();

  upsertNode(input: Omit<MemoryGraphNode, 'id' | 'updatedAt'> & { id?: string }): MemoryGraphNode {
    const id = input.id ?? randomUUID();
    const node: MemoryGraphNode = {
      id,
      type: input.type,
      label: input.label,
      attributes: input.attributes ?? {},
      domain: input.domain,
      updatedAt: new Date().toISOString(),
    };
    this.nodes.set(id, node);
    return node;
  }

  link(input: Omit<MemoryGraphEdge, 'id'> & { id?: string }): MemoryGraphEdge {
    if (!this.nodes.has(input.from) || !this.nodes.has(input.to)) {
      throw new Error('Both endpoints must exist before linking');
    }
    const edge: MemoryGraphEdge = {
      id: input.id ?? randomUUID(),
      from: input.from,
      to: input.to,
      relation: input.relation,
      weight: input.weight,
      attributes: input.attributes,
    };
    this.edges.set(edge.id, edge);
    return edge;
  }

  getNode(id: string): MemoryGraphNode | undefined {
    return this.nodes.get(id);
  }

  neighbors(nodeId: string, relation?: string): Array<{ node: MemoryGraphNode; edge: MemoryGraphEdge }> {
    const out: Array<{ node: MemoryGraphNode; edge: MemoryGraphEdge }> = [];
    for (const edge of this.edges.values()) {
      if (edge.from !== nodeId && edge.to !== nodeId) continue;
      if (relation && edge.relation !== relation) continue;
      const otherId = edge.from === nodeId ? edge.to : edge.from;
      const node = this.nodes.get(otherId);
      if (node) out.push({ node, edge });
    }
    return out;
  }

  search(query: string, opts?: { type?: string; domain?: string; limit?: number }): MemoryGraphNode[] {
    const q = query.toLowerCase();
    const limit = opts?.limit ?? 20;
    return [...this.nodes.values()]
      .filter((n) => (!opts?.type || n.type === opts.type) && (!opts?.domain || n.domain === opts.domain))
      .filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          JSON.stringify(n.attributes).toLowerCase().includes(q)
      )
      .slice(0, limit);
  }

  /** Export for DNA / persistence. */
  toJSON(): { nodes: MemoryGraphNode[]; edges: MemoryGraphEdge[] } {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] };
  }

  static fromJSON(data: { nodes: MemoryGraphNode[]; edges: MemoryGraphEdge[] }): AgentMemoryGraph {
    const g = new AgentMemoryGraph();
    for (const n of data.nodes) g.nodes.set(n.id, n);
    for (const e of data.edges) g.edges.set(e.id, e);
    return g;
  }
}
