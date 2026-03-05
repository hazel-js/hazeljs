/**
 * KnowledgeGraph
 *
 * In-memory directed graph that stores GraphRAG entities and relationships.
 * Uses Map-based adjacency lists for O(1) neighbour lookup.
 *
 * Key operations:
 *  - addEntity / addRelationship — incremental loading
 *  - mergeEntity — fold a duplicate entity into an existing one
 *  - bfsNeighbours — breadth-first traversal for local context
 *  - findEntitiesByName — fuzzy substring + exact matching for query seeding
 *  - getStats — live graph metrics
 */

import type {
  GraphEntity,
  GraphRelationship,
  GraphCommunity,
  CommunityReport,
  KnowledgeGraph,
  GraphStats,
} from './graph.types';

export class GraphStore implements KnowledgeGraph {
  readonly entities: Map<string, GraphEntity> = new Map();
  readonly relationships: Map<string, GraphRelationship> = new Map();
  /** Undirected adjacency: entityId → Set<entityId> */
  readonly adjacency: Map<string, Set<string>> = new Map();
  communities: GraphCommunity[] = [];
  readonly communityReports: Map<string, CommunityReport> = new Map();

  // ── Entities ──────────────────────────────────────────────────────────────

  addEntity(entity: GraphEntity): GraphEntity {
    const existing = this.entities.get(entity.id);
    if (existing) {
      return this.mergeEntity(entity.id, entity);
    }
    this.entities.set(entity.id, entity);
    if (!this.adjacency.has(entity.id)) {
      this.adjacency.set(entity.id, new Set());
    }
    return entity;
  }

  mergeEntity(existingId: string, incoming: Partial<GraphEntity>): GraphEntity {
    const existing = this.entities.get(existingId);
    if (!existing) throw new Error(`Entity ${existingId} not found`);

    const merged: GraphEntity = {
      ...existing,
      description: incoming.description
        ? `${existing.description}. ${incoming.description}`
        : existing.description,
      sourceDocIds: [...new Set([...existing.sourceDocIds, ...(incoming.sourceDocIds ?? [])])],
      metadata: { ...existing.metadata, ...incoming.metadata },
    };

    this.entities.set(existingId, merged);
    return merged;
  }

  /** Look up an entity by exact (case-insensitive) name. */
  findEntityByName(name: string): GraphEntity | undefined {
    const normalized = name.toLowerCase().trim();
    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase().trim() === normalized) return entity;
    }
    return undefined;
  }

  /**
   * Fuzzy-match entities whose name contains `query` (case-insensitive).
   * Returns up to `limit` results sorted by name length (exact-ish first).
   */
  findEntitiesByName(query: string, limit = 10): GraphEntity[] {
    const normalized = query.toLowerCase().trim();
    const results: GraphEntity[] = [];

    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase().includes(normalized)) {
        results.push(entity);
      }
    }

    return results.sort((a, b) => a.name.length - b.name.length).slice(0, limit);
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  addRelationship(rel: GraphRelationship): GraphRelationship {
    this.relationships.set(rel.id, rel);

    // Update undirected adjacency
    const srcAdj = this.adjacency.get(rel.sourceId) ?? new Set<string>();
    const tgtAdj = this.adjacency.get(rel.targetId) ?? new Set<string>();

    srcAdj.add(rel.targetId);
    tgtAdj.add(rel.sourceId);

    this.adjacency.set(rel.sourceId, srcAdj);
    this.adjacency.set(rel.targetId, tgtAdj);

    return rel;
  }

  /** Get all relationships connected to a given entity (as source or target). */
  getEntityRelationships(entityId: string): GraphRelationship[] {
    const results: GraphRelationship[] = [];
    for (const rel of this.relationships.values()) {
      if (rel.sourceId === entityId || rel.targetId === entityId) {
        results.push(rel);
      }
    }
    return results;
  }

  // ── Graph Traversal ───────────────────────────────────────────────────────

  /**
   * Breadth-first search from a set of seed entity IDs.
   * Returns all entities and relationships within `depth` hops,
   * plus the seed entities themselves.
   */
  bfsNeighbours(
    seedIds: string[],
    depth = 2
  ): { entities: GraphEntity[]; relationships: GraphRelationship[] } {
    const visitedEntities = new Set<string>(seedIds);
    const visitedRelationships = new Set<string>();
    let frontier = [...seedIds];

    for (let hop = 0; hop < depth; hop++) {
      const nextFrontier: string[] = [];

      for (const entityId of frontier) {
        const neighbours = this.adjacency.get(entityId) ?? new Set<string>();
        for (const neighbourId of neighbours) {
          if (!visitedEntities.has(neighbourId)) {
            visitedEntities.add(neighbourId);
            nextFrontier.push(neighbourId);
          }
        }
      }

      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    // Collect relationships that connect any two visited entities
    for (const rel of this.relationships.values()) {
      if (visitedEntities.has(rel.sourceId) && visitedEntities.has(rel.targetId)) {
        visitedRelationships.add(rel.id);
      }
    }

    const entities = [...visitedEntities]
      .map((id) => this.entities.get(id))
      .filter((e): e is GraphEntity => e !== undefined);

    const relationships = [...visitedRelationships]
      .map((id) => this.relationships.get(id))
      .filter((r): r is GraphRelationship => r !== undefined);

    return { entities, relationships };
  }

  // ── Communities ───────────────────────────────────────────────────────────

  setCommunities(communities: GraphCommunity[]): void {
    this.communities = communities;
  }

  addCommunityReport(report: CommunityReport): void {
    this.communityReports.set(report.communityId, report);
  }

  getCommunityForEntity(entityId: string): GraphCommunity | undefined {
    return this.communities.find((c) => c.entityIds.includes(entityId));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats(): GraphStats {
    const entityTypeBreakdown: Record<string, number> = {};
    const relationshipTypeBreakdown: Record<string, number> = {};

    for (const entity of this.entities.values()) {
      entityTypeBreakdown[entity.type] = (entityTypeBreakdown[entity.type] ?? 0) + 1;
    }

    for (const rel of this.relationships.values()) {
      relationshipTypeBreakdown[rel.type] = (relationshipTypeBreakdown[rel.type] ?? 0) + 1;
    }

    // Top connected entities
    const topEntities = [...this.entities.values()]
      .map((e) => ({
        name: e.name,
        type: e.type,
        connections: this.adjacency.get(e.id)?.size ?? 0,
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);

    const totalRelationships = this.relationships.size;
    const totalEntities = this.entities.size;

    return {
      totalEntities,
      totalRelationships,
      totalCommunities: this.communities.length,
      entityTypeBreakdown,
      relationshipTypeBreakdown,
      avgRelationshipsPerEntity: totalEntities > 0 ? (totalRelationships * 2) / totalEntities : 0,
      topEntities,
    };
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Returns a plain-object snapshot useful for JSON serialisation / API responses. */
  toJSON(): {
    entities: GraphEntity[];
    relationships: GraphRelationship[];
    communities: GraphCommunity[];
    communityReports: CommunityReport[];
    stats: GraphStats;
  } {
    return {
      entities: [...this.entities.values()],
      relationships: [...this.relationships.values()],
      communities: this.communities,
      communityReports: [...this.communityReports.values()],
      stats: this.getStats(),
    };
  }

  clear(): void {
    this.entities.clear();
    this.relationships.clear();
    this.adjacency.clear();
    this.communities = [];
    this.communityReports.clear();
  }
}
