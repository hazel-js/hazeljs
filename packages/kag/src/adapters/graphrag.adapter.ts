import type {
  KnowledgeEntity,
  KnowledgeExtractor,
  KnowledgeFact,
  KnowledgeRelation,
  KnowledgeScope,
} from '../types';
import type { KnowledgeGraph } from '../knowledge-graph';

/**
 * Minimal GraphRAG-like shapes so KAG can import without a hard dependency
 * on @hazeljs/rag at compile time.
 */
export interface GraphRagEntityLike {
  id: string;
  name: string;
  type: string;
  description?: string;
  sourceDocIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphRagRelationshipLike {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  weight?: number;
  sourceDocIds?: string[];
}

export interface GraphStoreLike {
  entities?: Map<string, GraphRagEntityLike> | GraphRagEntityLike[];
  relationships?: Map<string, GraphRagRelationshipLike> | GraphRagRelationshipLike[];
  // GraphStore from @hazeljs/rag exposes entities/relationships as Maps via toJSON / iteration
  [key: string]: unknown;
}

function asList<T>(value: Map<string, T> | T[] | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [...value.values()];
}

/**
 * Map GraphRAG entities/relations into KAG writes.
 */
export async function importGraph(
  graph: KnowledgeGraph,
  graphStore: GraphStoreLike,
  _scope?: KnowledgeScope
): Promise<{ entities: number; relations: number }> {
  // Prefer public getters if present (GraphStore)
  const entities =
    typeof (graphStore as { getStats?: () => unknown }).getStats === 'function'
      ? extractEntitiesFromStore(graphStore)
      : asList(
          graphStore.entities as Map<string, GraphRagEntityLike> | GraphRagEntityLike[] | undefined
        );

  const relationships =
    typeof (graphStore as { getStats?: () => unknown }).getStats === 'function'
      ? extractRelationsFromStore(graphStore)
      : asList(
          graphStore.relationships as
            | Map<string, GraphRagRelationshipLike>
            | GraphRagRelationshipLike[]
            | undefined
        );

  let entityCount = 0;
  for (const e of entities) {
    await graph.entity({
      id: e.id,
      type: e.type || 'OTHER',
      properties: {
        name: e.name,
        description: e.description ?? '',
      },
      metadata: {
        ...e.metadata,
        graphRagId: e.id,
        sourceDocIds: e.sourceDocIds,
      },
    });
    entityCount++;
  }

  let relationCount = 0;
  for (const r of relationships) {
    await graph.relate({
      id: r.id,
      from: r.sourceId,
      to: r.targetId,
      type: r.type,
      properties: {
        description: r.description,
        weight: r.weight,
        sourceDocIds: r.sourceDocIds,
      },
      confidence: r.weight !== undefined ? Math.min(1, r.weight / 10) : 0.8,
      source: { type: 'graphrag', id: r.id, authority: 50 },
    });
    relationCount++;
  }

  return { entities: entityCount, relations: relationCount };
}

function extractEntitiesFromStore(store: GraphStoreLike): GraphRagEntityLike[] {
  // GraphStore keeps private maps; support toJSON() if available
  const maybeJson = (store as { toJSON?: () => { entities?: GraphRagEntityLike[] } }).toJSON?.();
  if (maybeJson?.entities) return maybeJson.entities;
  if (store.entities) return asList(store.entities as Map<string, GraphRagEntityLike>);
  return [];
}

function extractRelationsFromStore(store: GraphStoreLike): GraphRagRelationshipLike[] {
  const maybeJson = (
    store as { toJSON?: () => { relationships?: GraphRagRelationshipLike[] } }
  ).toJSON?.();
  if (maybeJson?.relationships) return maybeJson.relationships;
  if (store.relationships) {
    return asList(store.relationships as Map<string, GraphRagRelationshipLike>);
  }
  return [];
}

/**
 * Maps a GraphRAG-style extraction result into KAG write shapes.
 */
export function mapExtractionResult(result: {
  entities?: GraphRagEntityLike[];
  relationships?: GraphRagRelationshipLike[];
}): {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
} {
  return {
    entities: (result.entities ?? []).map((e) => ({
      id: e.id,
      type: e.type || 'OTHER',
      properties: { name: e.name, description: e.description ?? '' },
      metadata: { graphRagId: e.id, sourceDocIds: e.sourceDocIds, ...e.metadata },
    })),
    relations: (result.relationships ?? []).map((r) => ({
      id: r.id,
      from: r.sourceId,
      to: r.targetId,
      type: r.type,
      properties: { description: r.description, weight: r.weight },
      confidence: r.weight !== undefined ? Math.min(1, r.weight / 10) : 0.8,
      source: { type: 'graphrag', id: r.id },
    })),
  };
}

export function createExtractionMapper(extract: KnowledgeExtractor['extract']): KnowledgeExtractor {
  return {
    async extract(input: unknown): Promise<{
      entities: KnowledgeEntity[];
      relations: KnowledgeRelation[];
      facts?: KnowledgeFact[];
    }> {
      const raw = await extract(input);
      return {
        entities: raw.entities,
        relations: raw.relations,
        facts: raw.facts,
      };
    },
  };
}
