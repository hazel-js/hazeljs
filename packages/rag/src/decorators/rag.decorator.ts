/**
 * @RAG Module Decorator
 * Configure RAG at module level
 */

import 'reflect-metadata';

export interface RAGModuleOptions {
  vectorDB?: 'pinecone' | 'weaviate' | 'qdrant' | 'chroma' | 'milvus' | 'pgvector' | 'redis' | 'memory';
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  indexName?: string;
  apiKey?: string;
  endpoint?: string;
  namespace?: string;
}

export interface ConversationalRAGOptions {
  memoryType?: 'buffer' | 'summary' | 'window';
  maxTokens?: number;
  sessionStore?: 'memory' | 'redis' | 'database';
}

export interface MultiModalEmbeddingOptions {
  models?: {
    text?: string;
    image?: string;
    code?: string;
  };
}

const RAG_MODULE_KEY = Symbol('ragModule');
const CONVERSATIONAL_RAG_KEY = Symbol('conversationalRAG');
const MULTIMODAL_EMBEDDING_KEY = Symbol('multiModalEmbedding');

/**
 * Configure RAG for a module
 */
export function RAG(options: RAGModuleOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(RAG_MODULE_KEY, options, target);
    return target;
  };
}

/**
 * Get RAG module configuration
 */
export function getRAGConfig(target: any): RAGModuleOptions | undefined {
  return Reflect.getMetadata(RAG_MODULE_KEY, target);
}

/**
 * Configure conversational RAG with memory
 */
export function ConversationalRAG(options: ConversationalRAGOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(CONVERSATIONAL_RAG_KEY, options, target);
    return target;
  };
}

/**
 * Configure multi-modal embeddings
 */
export function MultiModalEmbedding(options: MultiModalEmbeddingOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(MULTIMODAL_EMBEDDING_KEY, options, target);
    return target;
  };
}

/**
 * Embed image decorator
 */
export function EmbedImage(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('embedImage', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Embed code decorator
 */
export function EmbedCode(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('embedCode', true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Cross-modal search decorator
 */
export function CrossModalSearch(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('crossModalSearch', true, target, propertyKey);
    return descriptor;
  };
}
