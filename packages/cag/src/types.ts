/**
 * Cache-Augmented Generation types
 */

export type TokenBudgetStrategy = 'truncate' | 'priority' | 'compress' | 'summarize' | 'reject';

export type InvalidationStrategy = 'ttl' | 'version' | 'manual';

export type ContextSourceType =
  | 'text'
  | 'json'
  | 'file'
  | 'url'
  | 'function'
  | 'rag'
  | 'memory'
  | 'custom';

export interface ContextLoadInput {
  tenantId: string;
  namespace: string;
  agentId?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface ContextSourceDefinition {
  id: string;
  priority?: number;
  /** When false or priority >= 90, content is never rewritten by compression. */
  compressible?: boolean;
  version?: string;
  ttl?: number | string;
  source:
    | { type: 'text'; content: string }
    | { type: 'json'; data: unknown }
    | { type: 'file'; path: string }
    | { type: 'url'; url: string }
    | { type: 'function'; load: (input: ContextLoadInput) => Promise<string> | string }
    | { type: 'rag'; retrieve: (input: ContextLoadInput) => Promise<string> | string }
    | { type: 'memory'; load: (input: ContextLoadInput) => Promise<string> | string }
    | { type: 'custom'; load: (input: ContextLoadInput) => Promise<string> | string };
}

export interface LoadedSourceChunk {
  id: string;
  content: string;
  priority: number;
  compressible: boolean;
  version?: string;
  tokenEstimate: number;
}

export interface CachedContext {
  text: string;
  fingerprint: string;
  tokenCount: number;
  namespace: string;
  tenantId: string;
  agentId?: string;
  version?: string;
  sourceIds: string[];
  builtAt: number;
  expiresAt?: number;
  compressionRatio?: number;
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  ttlSeconds?: number;
}

export interface CagStore {
  get(key: string): Promise<CachedContext | null>;
  set(key: string, value: CachedContext, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;
  keys?(pattern?: string): Promise<string[]>;
}

export interface PreparedContext {
  text: string;
  fingerprint: string;
  tokenCount: number;
  namespace: string;
  tenantId: string;
}

export interface ProviderCachedContext {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  /** Opaque handle or cache key for the provider. */
  cacheKey?: string;
  /** Suggested breakpoint offsets (chars) for Anthropic-style cache_control. */
  breakpoints?: number[];
  /** Gemini cached content name / resource. */
  cachedContent?: string;
  metadata?: Record<string, unknown>;
}

export interface PromptCacheProvider {
  prepare(context: PreparedContext): Promise<ProviderCachedContext>;
}

export interface GetContextInput {
  namespace: string;
  tenantId: string;
  agentId?: string;
  version?: string;
  force?: boolean;
  metadata?: Record<string, unknown>;
}

export interface InvalidateInput {
  tenantId: string;
  namespace?: string;
  agentId?: string;
  version?: string;
}

export interface TokenBudgetConfig {
  max: number;
  strategy?: TokenBudgetStrategy;
}

export interface CagModuleOptions {
  store?: 'memory' | 'redis' | CagStore;
  ttl?: number | string;
  maxTokens?: number;
  compression?: boolean;
  invalidation?: {
    strategy?: InvalidationStrategy;
  };
  tokenBudget?: TokenBudgetConfig;
  multiTenant?: boolean;
  strict?: boolean;
  /** Optional USD cost per million input tokens for estimatedCostSaved metrics. */
  usdPerMillionInputTokens?: number;
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    client?: RedisLikeClient;
  };
  promptCache?: PromptCacheProvider;
  summarizer?: (text: string, maxTokens: number) => Promise<string> | string;
  tokenCounter?: (text: string) => number;
  sources?: ContextSourceDefinition[];
  eventEmitter?: {
    emit(event: string, ...values: unknown[]): unknown;
  };
}

export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit?(): Promise<void>;
}

export interface CagMetrics {
  hits: number;
  misses: number;
  builds: number;
  invalidations: number;
  compressions: number;
  hitRatio: number;
  lastBuildLatencyMs: number;
  lastContextSize: number;
  lastTokenCount: number;
  tokensSaved: number;
  estimatedCostSaved?: number;
  lastCompressionRatio?: number;
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

export const CAG_OPTIONS = 'CAG_OPTIONS';

export const CAG_EVENTS = {
  CONTEXT_HIT: 'cag.context.hit',
  CONTEXT_MISS: 'cag.context.miss',
  CONTEXT_BUILD: 'cag.context.build',
  CONTEXT_INVALIDATE: 'cag.context.invalidate',
  CONTEXT_COMPRESS: 'cag.context.compress',
  STORE_ERROR: 'cag.store.error',
} as const;
