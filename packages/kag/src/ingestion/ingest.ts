import type {
  KnowledgeEntity,
  KnowledgeExtractor,
  KnowledgeFact,
  KnowledgeRelation,
} from '../types';
import type { KnowledgeGraph } from '../knowledge-graph';
import { EntityResolver } from '../resolution/entity-resolver';

export interface IngestBatch {
  entities?: KnowledgeEntity[];
  relations?: KnowledgeRelation[];
  facts?: KnowledgeFact[];
}

export interface IngestResult {
  entities: number;
  relations: number;
  facts: number;
  unresolvedCandidates: number;
}

/**
 * Ingestion pipeline: extract → resolve → dedupe → validate → write.
 * Uncertain entity matches are not merged.
 */
export async function ingestKnowledge(
  graph: KnowledgeGraph,
  batch: IngestBatch,
  options?: {
    extractor?: KnowledgeExtractor;
    raw?: unknown;
    resolver?: EntityResolver;
  }
): Promise<IngestResult> {
  let entities = batch.entities ?? [];
  let relations = batch.relations ?? [];
  let facts = batch.facts ?? [];

  if (options?.extractor && options.raw !== undefined) {
    const extracted = await options.extractor.extract(options.raw);
    entities = [...entities, ...extracted.entities];
    relations = [...relations, ...extracted.relations];
    facts = [...facts, ...(extracted.facts ?? [])];
  }

  // Deduplicate entities by id
  const entityById = new Map<string, KnowledgeEntity>();
  for (const e of entities) {
    entityById.set(e.id, e);
  }

  let unresolvedCandidates = 0;
  for (const entity of entityById.values()) {
    const resolution = await graph.resolve(entity);
    if (resolution.merged) {
      await graph.entity(resolution.merged);
    } else {
      if (resolution.candidates.length > 0) {
        unresolvedCandidates += resolution.candidates.length;
      }
      await graph.entity(entity);
    }
  }

  // Deduplicate relations
  const relKeys = new Set<string>();
  let relationCount = 0;
  for (const rel of relations) {
    const key = rel.id ?? `${rel.from}:${rel.type}:${rel.to}`;
    if (relKeys.has(key)) continue;
    relKeys.add(key);
    await graph.relate(rel);
    relationCount++;
  }

  let factCount = 0;
  for (const fact of facts) {
    // Basic validation
    if (!fact.subject || !fact.predicate) continue;
    await graph.fact(fact);
    factCount++;
  }

  return {
    entities: entityById.size,
    relations: relationCount,
    facts: factCount,
    unresolvedCandidates,
  };
}
