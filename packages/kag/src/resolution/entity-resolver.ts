import type {
  EntityResolutionCandidate,
  EntityResolutionResult,
  EntityResolutionStrategy,
  KnowledgeEntity,
} from '../types';

export interface EntityResolverOptions {
  strategies?: EntityResolutionStrategy[];
  mergeThreshold?: number;
  embed?: (text: string) => Promise<number[]> | number[];
  custom?: (
    candidate: KnowledgeEntity,
    existing: KnowledgeEntity[]
  ) => Promise<EntityResolutionCandidate[]> | EntityResolutionCandidate[];
}

/**
 * Extensible entity resolution. Uncertain matches are returned as candidates
 * and are never auto-merged below mergeThreshold.
 */
export class EntityResolver {
  private readonly strategies: EntityResolutionStrategy[];
  private readonly mergeThreshold: number;
  private readonly embed?: EntityResolverOptions['embed'];
  private readonly custom?: EntityResolverOptions['custom'];

  constructor(options: EntityResolverOptions = {}) {
    this.strategies = options.strategies ?? ['exact', 'normalized'];
    this.mergeThreshold = options.mergeThreshold ?? 0.9;
    this.embed = options.embed;
    this.custom = options.custom;
  }

  async resolve(
    candidate: KnowledgeEntity,
    existing: KnowledgeEntity[]
  ): Promise<EntityResolutionResult> {
    const candidates: EntityResolutionCandidate[] = [];

    for (const strategy of this.strategies) {
      if (strategy === 'exact') {
        for (const entity of existing) {
          if (entity.id === candidate.id) {
            candidates.push({ entity, confidence: 1, strategy: 'exact' });
          } else if (namesMatchExact(entity, candidate)) {
            candidates.push({ entity, confidence: 0.99, strategy: 'exact' });
          }
        }
      }

      if (strategy === 'normalized') {
        const candNorm = normalizeName(displayName(candidate));
        for (const entity of existing) {
          const entNorm = normalizeName(displayName(entity));
          if (candNorm && entNorm && candNorm === entNorm) {
            candidates.push({ entity, confidence: 0.95, strategy: 'normalized' });
          }
        }
      }

      if (strategy === 'semantic' && this.embed) {
        const candVec = await this.embed(displayName(candidate));
        for (const entity of existing) {
          const entVec = await this.embed(displayName(entity));
          const sim = cosineSimilarity(candVec, entVec);
          if (sim >= 0.8) {
            candidates.push({ entity, confidence: sim, strategy: 'semantic' });
          }
        }
      }

      if (strategy === 'custom' && this.custom) {
        candidates.push(...(await this.custom(candidate, existing)));
      }
    }

    // Deduplicate by entity id, keep highest confidence
    const byId = new Map<string, EntityResolutionCandidate>();
    for (const c of candidates) {
      const prev = byId.get(c.entity.id);
      if (!prev || c.confidence > prev.confidence) {
        byId.set(c.entity.id, c);
      }
    }
    const unique = [...byId.values()].sort((a, b) => b.confidence - a.confidence);
    const best = unique[0];
    if (best && best.confidence >= this.mergeThreshold) {
      return {
        merged: {
          ...best.entity,
          aliases: uniqueAliases(best.entity, candidate),
          properties: { ...best.entity.properties, ...candidate.properties },
          confidence: best.confidence,
        },
        candidates: unique,
      };
    }
    return { candidates: unique };
  }
}

function displayName(entity: KnowledgeEntity): string {
  const name = entity.properties.name ?? entity.properties.title ?? entity.id;
  return String(name);
}

function namesMatchExact(a: KnowledgeEntity, b: KnowledgeEntity): boolean {
  const an = displayName(a);
  const bn = displayName(b);
  if (an === bn) return true;
  const aliasesA = a.aliases ?? [];
  const aliasesB = b.aliases ?? [];
  return aliasesA.includes(bn) || aliasesB.includes(an);
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co)\b/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function uniqueAliases(base: KnowledgeEntity, incoming: KnowledgeEntity): string[] {
  const set = new Set<string>([
    ...(base.aliases ?? []),
    ...(incoming.aliases ?? []),
    displayName(incoming),
    displayName(base),
  ]);
  set.delete(displayName(base));
  return [...set].filter(Boolean);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
