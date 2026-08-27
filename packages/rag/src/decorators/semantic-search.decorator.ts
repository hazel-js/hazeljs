/**
 * Semantic Search Decorators
 * Enable semantic search capabilities on methods
 */

import 'reflect-metadata';

export interface SemanticSearchOptions {
  topK?: number;
  minScore?: number;
  includeMetadata?: boolean;
  filter?: Record<string, unknown>;
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  algorithm?: 'rrf' | 'weighted' | 'linear';
}

const SEMANTIC_SEARCH_KEY = Symbol('semanticSearch');
const HYBRID_SEARCH_KEY = Symbol('hybridSearch');

/** Optional hook: embed text after entity persistence (wire to RAGPipeline / embedding provider). */
let autoEmbedHandler: ((text: string) => Promise<void>) | undefined;

/**
 * Register a global handler for {@link AutoEmbed} (e.g. upsert into your vector index).
 */
export function configureAutoEmbed(handler: (text: string) => Promise<void>): void {
  autoEmbedHandler = handler;
}

/**
 * Enables semantic search on a method
 */
export function SemanticSearch(options: SemanticSearchOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(SEMANTIC_SEARCH_KEY, options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Enables hybrid search (vector + keyword) on a method
 */
export function HybridSearch(options: HybridSearchOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(HYBRID_SEARCH_KEY, options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Auto-embed decorator — after the method returns, text fields are passed to {@link configureAutoEmbed}.
 */
export function AutoEmbed(fields?: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as (...a: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const result = await originalMethod.apply(this, args);

      if (autoEmbedHandler && result && typeof result === 'object') {
        const obj = result as Record<string, unknown>;
        const keys = fields?.length ? fields : Object.keys(obj);
        for (const k of keys) {
          const v = obj[k];
          if (typeof v === 'string' && v.trim()) {
            await autoEmbedHandler(v);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Multi-query RAG decorator
 */
export function MultiQueryRAG(options: { queries?: number } = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('multiQueryRAG', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Compress context decorator
 */
export function CompressContext(options: { maxTokens?: number } = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('compressContext', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Self-query RAG with automatic metadata filtering
 */
export function SelfQueryRAG(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('selfQueryRAG', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Rerank results decorator
 */
export function Rerank(options: { model?: string; topN?: number } = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rerank', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Parent-child document retrieval
 */
export function ParentChildRetrieval(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('parentChildRetrieval', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Ensemble retrieval combining multiple methods
 */
export function EnsembleRetrieval(
  options: {
    methods?: string[];
    weights?: number[];
  } = {}
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('ensembleRetrieval', options, target, propertyKey);
    return descriptor;
  };
}

const TIME_WEIGHTED_RETRIEVAL_KEY = Symbol('timeWeightedRetrieval');

export interface TimeWeightedRetrievalOptions {
  /** Half-life in days for recency decay (default: 180). */
  halfLifeDays?: number;
  /** Over-fetch multiplier before re-ranking (default: 3). */
  overFetchMultiplier?: number;
  /** Filter clearly expired dated content (default: true). */
  filterExpired?: boolean;
}

export interface TimeWeightedSearchResult {
  score: number;
  metadata?: Record<string, unknown>;
  content?: string;
}

let timeWeightedRetrievalHandler:
  | ((
      results: TimeWeightedSearchResult[],
      options: TimeWeightedRetrievalOptions
    ) => TimeWeightedSearchResult[])
  | undefined;

/**
 * Register a global handler for {@link TimeWeightedRetrieval} (e.g. applyRecencyRanking from freshness module).
 */
export function configureTimeWeightedRetrieval(
  handler: (
    results: TimeWeightedSearchResult[],
    options: TimeWeightedRetrievalOptions
  ) => TimeWeightedSearchResult[]
): void {
  timeWeightedRetrievalHandler = handler;
}

export function getTimeWeightedRetrievalOptions(
  target: object,
  propertyKey: string | symbol
): TimeWeightedRetrievalOptions | undefined {
  return Reflect.getMetadata(TIME_WEIGHTED_RETRIEVAL_KEY, target, propertyKey) as
    | TimeWeightedRetrievalOptions
    | undefined;
}

/**
 * Apply time-weighted re-ranking when a handler is configured via {@link configureTimeWeightedRetrieval}.
 */
export function applyTimeWeightedRetrievalIfConfigured<T extends TimeWeightedSearchResult>(
  target: object,
  propertyKey: string | symbol,
  results: T[]
): T[] {
  const options = getTimeWeightedRetrievalOptions(target, propertyKey);
  if (!options || !timeWeightedRetrievalHandler) return results;
  return timeWeightedRetrievalHandler(results, options) as T[];
}

/**
 * Time-weighted retrieval favoring recent documents.
 * When {@link configureTimeWeightedRetrieval} is set, wraps the method to re-rank its SearchResult[] return value.
 */
export function TimeWeightedRetrieval(options: TimeWeightedRetrievalOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(TIME_WEIGHTED_RETRIEVAL_KEY, options, target, propertyKey);

    if (!timeWeightedRetrievalHandler) {
      return descriptor;
    }

    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const result = await originalMethod.apply(this, args);
      if (!Array.isArray(result)) return result;
      return applyTimeWeightedRetrievalIfConfigured(
        target,
        propertyKey,
        result as TimeWeightedSearchResult[]
      );
    };

    return descriptor;
  };
}
