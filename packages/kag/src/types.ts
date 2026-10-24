/**
 * Knowledge-Augmented Generation types
 */

export interface KnowledgeSource {
  type: string;
  id?: string;
  authority?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEntity {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  aliases?: string[];
  confidence?: number;
}

export interface KnowledgeRelation {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
  confidence?: number;
  source?: KnowledgeSource;
}

export interface KnowledgeFact {
  id?: string;
  subject: string;
  predicate: string;
  object: unknown;
  confidence?: number;
  source?: KnowledgeSource;
  validFrom?: Date | string;
  validUntil?: Date | string;
  priority?: number;
  createdAt?: Date | string;
}

export interface KnowledgeScope {
  tenantId: string;
  graph?: string;
}

export interface KnowledgeQuery {
  entityIds?: string[];
  types?: string[];
  predicate?: string;
  asOf?: Date | string;
  currentOnly?: boolean;
  limit?: number;
}

export interface TraversalOptions {
  depth?: number;
  relationTypes?: string[];
  asOf?: Date | string;
}

export interface TraversalResult {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  facts: KnowledgeFact[];
  confidence: number;
}

export interface KnowledgeResult {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  facts: KnowledgeFact[];
  contradictions?: KnowledgeFact[][];
}

export interface KnowledgeEvidence {
  entity?: string;
  relation?: string;
  entity2?: string;
  fact?: KnowledgeFact;
  source?: KnowledgeSource;
}

export interface KnowledgeAnswer {
  answer?: string;
  evidence: KnowledgeEvidence[];
  sources: KnowledgeSource[];
  confidence: number;
  alternatives?: KnowledgeFact[];
  explanation?: string;
}

export interface AskOptions {
  explain?: boolean;
  rag?: boolean;
  asOf?: Date | string;
  depth?: number;
  graph?: string;
}

export interface EntityResolutionCandidate {
  entity: KnowledgeEntity;
  confidence: number;
  strategy: string;
}

export interface EntityResolutionResult {
  merged?: KnowledgeEntity;
  candidates: EntityResolutionCandidate[];
}

export type EntityResolutionStrategy = 'exact' | 'normalized' | 'semantic' | 'custom';

export type ContradictionPolicy = 'keep' | 'rank' | 'reject';

export type ConfidenceAggregation = 'min' | 'product';

export interface KnowledgeStore {
  upsertEntity(scope: KnowledgeScope, entity: KnowledgeEntity): Promise<void>;
  upsertRelation(scope: KnowledgeScope, relation: KnowledgeRelation): Promise<void>;
  upsertFact(
    scope: KnowledgeScope,
    fact: KnowledgeFact
  ): Promise<{ contradictions: KnowledgeFact[] }>;
  getEntity(scope: KnowledgeScope, id: string): Promise<KnowledgeEntity | null>;
  query(scope: KnowledgeScope, query: KnowledgeQuery): Promise<KnowledgeResult>;
  traverse(
    scope: KnowledgeScope,
    seedIds: string[],
    options?: TraversalOptions
  ): Promise<TraversalResult>;
  listEntities(scope: KnowledgeScope): Promise<KnowledgeEntity[]>;
  clear?(scope: KnowledgeScope): Promise<void>;
}

export interface KnowledgeAuthorizer {
  canAccess(
    scope: KnowledgeScope,
    action: 'read' | 'write',
    resource: { kind: 'entity' | 'relation' | 'fact' | 'source'; id?: string; type?: string }
  ): Promise<boolean> | boolean;
}

export interface KnowledgeRetriever {
  search(
    query: string,
    options?: { topK?: number; tenantId?: string }
  ): Promise<Array<{ content: string; id?: string; score?: number }>>;
}

export interface KnowledgeExtractor {
  extract(input: unknown): Promise<{
    entities: KnowledgeEntity[];
    relations: KnowledgeRelation[];
    facts?: KnowledgeFact[];
  }>;
}

export interface KnowledgeQueryPlanner {
  plan(
    question: string,
    context: { scope: KnowledgeScope; entities: KnowledgeEntity[] }
  ): Promise<{
    seedIds: string[];
    depth: number;
    relationTypes?: string[];
    template?: string;
  }>;
}

export interface ObservationPromotion {
  subject: string;
  predicate: string;
  object: unknown;
  confidence: number;
  validated: boolean;
  source?: KnowledgeSource;
  validFrom?: Date | string;
  validUntil?: Date | string;
}

export interface ContextContribution {
  text: string;
  evidence?: unknown[];
  fingerprint?: string;
}

export interface ContextContributor {
  readonly kind: 'cag' | 'kag';
  contribute(request: {
    query: string;
    tenantId: string;
    namespace?: string;
    agentId?: string;
  }): Promise<ContextContribution>;
}

export interface KagModuleOptions {
  store?: KnowledgeStore;
  tenantId?: string;
  graph?: string;
  multiTenant?: boolean;
  mergeThreshold?: number;
  contradictionPolicy?: ContradictionPolicy;
  confidenceAggregation?: ConfidenceAggregation;
  authorizer?: KnowledgeAuthorizer;
  retriever?: KnowledgeRetriever;
  extractor?: KnowledgeExtractor;
  planner?: KnowledgeQueryPlanner;
  /**
   * Industry / domain profile for the default HeuristicQueryPlanner.
   * Ignored when `planner` is provided explicitly.
   * Defaults to a generic (non-commerce) profile.
   */
  industry?:
    | import('./planner/industry-profiles').IndustryProfile
    | import('./planner/industry-profiles').IndustryProfile[];
  llm?: (prompt: string) => Promise<string> | string;
  eventEmitter?: {
    emit(event: string, ...values: unknown[]): unknown;
  };
  embed?: (text: string) => Promise<number[]> | number[];
}

export const KAG_OPTIONS = 'KAG_OPTIONS';

export const KAG_EVENTS = {
  ENTITY_CREATED: 'kag.entity.created',
  ENTITY_UPDATED: 'kag.entity.updated',
  RELATION_CREATED: 'kag.relation.created',
  FACT_ADDED: 'kag.fact.added',
  CONTRADICTION_DETECTED: 'kag.contradiction.detected',
  QUERY_COMPLETED: 'kag.query.completed',
} as const;
