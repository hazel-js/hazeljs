/**
 * Semantic Search Decorators
 * Enable semantic search capabilities on methods
 */

import 'reflect-metadata';

export interface SemanticSearchOptions {
  topK?: number;
  minScore?: number;
  includeMetadata?: boolean;
  filter?: Record<string, any>;
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  algorithm?: 'rrf' | 'weighted' | 'linear';
}

const SEMANTIC_SEARCH_KEY = Symbol('semanticSearch');
const HYBRID_SEARCH_KEY = Symbol('hybridSearch');

/**
 * Enables semantic search on a method
 */
export function SemanticSearch(options: SemanticSearchOptions = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(SEMANTIC_SEARCH_KEY, options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Enables hybrid search (vector + keyword) on a method
 */
export function HybridSearch(options: HybridSearchOptions = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(HYBRID_SEARCH_KEY, options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Auto-embed decorator for automatic embedding generation
 */
export function AutoEmbed(fields?: string[]): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // TODO: Implement automatic embedding generation
      // This would integrate with the RAG service to generate embeddings
      
      return result;
    };

    return descriptor;
  };
}

/**
 * Multi-query RAG decorator
 */
export function MultiQueryRAG(options: { queries?: number } = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('multiQueryRAG', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Compress context decorator
 */
export function CompressContext(options: { maxTokens?: number } = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('compressContext', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Self-query RAG with automatic metadata filtering
 */
export function SelfQueryRAG(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('selfQueryRAG', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Rerank results decorator
 */
export function Rerank(options: { model?: string; topN?: number } = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('rerank', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Parent-child document retrieval
 */
export function ParentChildRetrieval(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('parentChildRetrieval', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Ensemble retrieval combining multiple methods
 */
export function EnsembleRetrieval(options: {
  methods?: string[];
  weights?: number[];
} = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('ensembleRetrieval', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Time-weighted retrieval favoring recent documents
 */
export function TimeWeightedRetrieval(options: { decayRate?: number } = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('timeWeightedRetrieval', options, target, propertyKey);
    return descriptor;
  };
}
