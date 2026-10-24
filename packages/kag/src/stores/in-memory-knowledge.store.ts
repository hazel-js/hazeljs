import { randomUUID } from 'crypto';
import type {
  ContradictionPolicy,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgeQuery,
  KnowledgeRelation,
  KnowledgeResult,
  KnowledgeScope,
  KnowledgeStore,
  TraversalOptions,
  TraversalResult,
} from '../types';
import { KagError } from '../errors/kag.error';
import { factsOverlap, isFactValidAt, objectsEqual } from '../temporal';
import { aggregateConfidence } from '../confidence';

interface Partition {
  entities: Map<string, KnowledgeEntity>;
  relations: Map<string, KnowledgeRelation>;
  facts: KnowledgeFact[];
  adjacency: Map<string, Set<string>>;
}

function scopeKey(scope: KnowledgeScope): string {
  if (!scope.tenantId) {
    throw KagError.tenantRequired();
  }
  return `${scope.tenantId}::${scope.graph ?? 'default'}`;
}

/**
 * Tenant-partitioned in-memory knowledge store for development and tests.
 */
export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly partitions = new Map<string, Partition>();

  constructor(private readonly contradictionPolicy: ContradictionPolicy = 'rank') {}

  private partition(scope: KnowledgeScope): Partition {
    const key = scopeKey(scope);
    let part = this.partitions.get(key);
    if (!part) {
      part = {
        entities: new Map(),
        relations: new Map(),
        facts: [],
        adjacency: new Map(),
      };
      this.partitions.set(key, part);
    }
    return part;
  }

  async upsertEntity(scope: KnowledgeScope, entity: KnowledgeEntity): Promise<void> {
    const part = this.partition(scope);
    part.entities.set(entity.id, { ...entity, properties: { ...entity.properties } });
  }

  async upsertRelation(scope: KnowledgeScope, relation: KnowledgeRelation): Promise<void> {
    const part = this.partition(scope);
    const id = relation.id || `${relation.from}:${relation.type}:${relation.to}`;
    const stored = { ...relation, id };
    part.relations.set(id, stored);
    if (!part.adjacency.has(relation.from)) part.adjacency.set(relation.from, new Set());
    if (!part.adjacency.has(relation.to)) part.adjacency.set(relation.to, new Set());
    part.adjacency.get(relation.from)!.add(relation.to);
    part.adjacency.get(relation.to)!.add(relation.from);
  }

  async upsertFact(
    scope: KnowledgeScope,
    fact: KnowledgeFact
  ): Promise<{ contradictions: KnowledgeFact[] }> {
    const part = this.partition(scope);
    const stored: KnowledgeFact = {
      ...fact,
      id: fact.id ?? randomUUID(),
      createdAt: fact.createdAt ?? new Date().toISOString(),
      confidence: fact.confidence ?? 1,
    };

    const contradictions = part.facts.filter(
      (existing) =>
        existing.subject === stored.subject &&
        existing.predicate === stored.predicate &&
        factsOverlap(existing, stored) &&
        !objectsEqual(existing.object, stored.object)
    );

    if (contradictions.length > 0 && this.contradictionPolicy === 'reject') {
      throw KagError.conflict('Contradicting fact rejected by policy', {
        fact: stored,
        contradictions,
      });
    }

    part.facts.push(stored);
    return { contradictions };
  }

  async getEntity(scope: KnowledgeScope, id: string): Promise<KnowledgeEntity | null> {
    return this.partition(scope).entities.get(id) ?? null;
  }

  async query(scope: KnowledgeScope, query: KnowledgeQuery): Promise<KnowledgeResult> {
    const part = this.partition(scope);
    let entities = [...part.entities.values()];
    if (query.entityIds?.length) {
      const set = new Set(query.entityIds);
      entities = entities.filter((e) => set.has(e.id));
    }
    if (query.types?.length) {
      const set = new Set(query.types);
      entities = entities.filter((e) => set.has(e.type));
    }

    let facts = part.facts.filter((f) => {
      if (query.entityIds?.length && !query.entityIds.includes(f.subject)) return false;
      if (query.predicate && f.predicate !== query.predicate) return false;
      if (query.currentOnly || query.asOf) {
        return isFactValidAt(f, query.asOf);
      }
      return true;
    });

    if (query.limit) {
      facts = facts.slice(0, query.limit);
      entities = entities.slice(0, query.limit);
    }

    const relations = [...part.relations.values()].filter((r) => {
      if (!query.entityIds?.length) return true;
      return query.entityIds.includes(r.from) || query.entityIds.includes(r.to);
    });

    const contradictions = this.groupContradictions(facts);

    return { entities, relations, facts, contradictions };
  }

  async traverse(
    scope: KnowledgeScope,
    seedIds: string[],
    options: TraversalOptions = {}
  ): Promise<TraversalResult> {
    const part = this.partition(scope);
    const depth = options.depth ?? 2;
    const visited = new Set<string>();
    const queue: Array<{ id: string; d: number }> = seedIds.map((id) => ({ id, d: 0 }));
    const entityIds = new Set<string>();
    const relationIds = new Set<string>();

    while (queue.length > 0) {
      const { id, d } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      entityIds.add(id);
      if (d >= depth) continue;

      for (const rel of part.relations.values()) {
        if (options.relationTypes && !options.relationTypes.includes(rel.type)) {
          continue;
        }
        let neighbor: string | null = null;
        if (rel.from === id) neighbor = rel.to;
        else if (rel.to === id) neighbor = rel.from;
        if (!neighbor) continue;
        relationIds.add(rel.id);
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, d: d + 1 });
        }
      }
    }

    const entities = [...entityIds]
      .map((id) => part.entities.get(id))
      .filter((e): e is KnowledgeEntity => Boolean(e));
    const relations = [...relationIds]
      .map((id) => part.relations.get(id))
      .filter((r): r is KnowledgeRelation => Boolean(r));
    const facts = part.facts.filter(
      (f) => entityIds.has(f.subject) && isFactValidAt(f, options.asOf)
    );

    const confidences = [
      ...relations.map((r) => r.confidence ?? 1),
      ...facts.map((f) => f.confidence ?? 1),
    ];

    return {
      entities,
      relations,
      facts,
      confidence: aggregateConfidence(confidences, 'min'),
    };
  }

  async listEntities(scope: KnowledgeScope): Promise<KnowledgeEntity[]> {
    return [...this.partition(scope).entities.values()];
  }

  async clear(scope: KnowledgeScope): Promise<void> {
    this.partitions.delete(scopeKey(scope));
  }

  private groupContradictions(facts: KnowledgeFact[]): KnowledgeFact[][] {
    const groups: KnowledgeFact[][] = [];
    const used = new Set<string>();
    for (const fact of facts) {
      if (!fact.id || used.has(fact.id)) continue;
      const sameSlot = facts.filter(
        (other) =>
          other.subject === fact.subject &&
          other.predicate === fact.predicate &&
          factsOverlap(fact, other)
      );
      const distinctObjects = new Set(sameSlot.map((f) => JSON.stringify(f.object)));
      if (sameSlot.length > 1 && distinctObjects.size > 1) {
        for (const g of sameSlot) {
          if (g.id) used.add(g.id);
        }
        groups.push(sameSlot);
      }
    }
    return groups;
  }
}
