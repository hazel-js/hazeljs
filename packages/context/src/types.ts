/**
 * Unified Agent Context Engine types.
 *
 * CAG / RAG / KAG / Memory remain separate packages; this layer plans
 * which contributors to invoke and assembles their output for the LLM.
 */

export type ContextSourceKind = 'cache' | 'cag' | 'rag' | 'knowledge' | 'kag' | 'memory';

/** Canonical contributor kinds used internally after alias normalization. */
export type ContextContributorKind = 'cag' | 'rag' | 'kag' | 'memory';

export type ContextStrategy = 'auto' | 'all' | 'explicit';

export interface ContextRequest {
  query: string;
  tenantId: string;
  namespace?: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextContribution {
  kind: ContextContributorKind;
  text: string;
  evidence?: unknown[];
  fingerprint?: string;
  confidence?: number;
  latencyMs?: number;
}

export interface ContextContributor {
  readonly kind: ContextContributorKind;
  contribute(request: ContextRequest): Promise<
    Omit<ContextContribution, 'kind' | 'latencyMs'> & {
      kind?: ContextContributorKind;
    }
  >;
}

export interface ContextPlan {
  /** Ordered contributor kinds to invoke. */
  sources: ContextContributorKind[];
  /** Human-readable rationale for observability (not model CoT). */
  rationale: string[];
}

export interface ContextAssemblyOptions {
  maxTokens?: number;
  /** Separator between contributor blocks. */
  separator?: string;
}

export interface AssembledContext {
  text: string;
  contributions: ContextContribution[];
  plan: ContextPlan;
  tokenEstimate: number;
  sourcesUsed: ContextContributorKind[];
}

export interface ContextModuleOptions {
  /**
   * Planning strategy:
   * - auto: heuristic selection from the query
   * - all: invoke every registered contributor
   * - explicit: only `sources` (required)
   */
  strategy?: ContextStrategy;
  /**
   * Preferred source order / allow-list.
   * Accepts aliases: cache→cag, knowledge→kag.
   */
  sources?: ContextSourceKind[];
  maxTokens?: number;
  contributors?: ContextContributor[];
  /** Duck-typed ports — wrapped into contributors when provided. */
  cag?: CagPort;
  rag?: RagPort;
  kag?: KagPort;
  memory?: MemoryPort;
  eventEmitter?: {
    emit(event: string, ...values: unknown[]): unknown;
  };
}

export interface CagPort {
  getContext(input: {
    namespace: string;
    tenantId: string;
    agentId?: string;
  }): Promise<{ context: { text: string; fingerprint?: string }; hit?: boolean }>;
  contribute?(
    request: ContextRequest
  ): Promise<{ text: string; evidence?: unknown[]; fingerprint?: string }>;
}

export interface RagPort {
  search(
    query: string,
    options?: { topK?: number; filter?: Record<string, unknown> }
  ): Promise<Array<{ content?: string; text?: string; score?: number; id?: string }>>;
}

export interface KagPort {
  ask(
    question: string,
    options?: { explain?: boolean; tenantId?: string; graph?: string }
  ): Promise<{
    answer?: string;
    explanation?: string;
    evidence?: unknown[];
    confidence?: number;
  }>;
  contribute?(
    request: ContextRequest
  ): Promise<{ text: string; evidence?: unknown[]; fingerprint?: string }>;
}

export interface MemoryPort {
  /** Prefer getByUserAndCategory / query when available. */
  query?(input: {
    userId: string;
    limit?: number;
  }): Promise<Array<{ key?: string; value?: unknown; category?: string }>>;
  getByUserAndCategory?(
    userId: string,
    category: string
  ): Promise<Array<{ key?: string; value?: unknown }>>;
  /** Agent / RAG MemoryManager-style fallback. */
  getConversationHistory?(
    sessionId: string,
    maxHistory?: number
  ): Promise<Array<{ role?: string; content?: string }>>;
}

export const CONTEXT_OPTIONS = 'CONTEXT_OPTIONS';

export const CONTEXT_EVENTS = {
  PLANNED: 'context.planned',
  ASSEMBLED: 'context.assembled',
  CONTRIBUTOR_OK: 'context.contributor.ok',
  CONTRIBUTOR_FAILED: 'context.contributor.failed',
} as const;

export function normalizeSourceKind(kind: ContextSourceKind): ContextContributorKind {
  switch (kind) {
    case 'cache':
    case 'cag':
      return 'cag';
    case 'knowledge':
    case 'kag':
      return 'kag';
    case 'rag':
      return 'rag';
    case 'memory':
      return 'memory';
    default:
      return 'rag';
  }
}
