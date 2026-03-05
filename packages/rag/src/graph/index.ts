/**
 * @hazeljs/rag — GraphRAG
 *
 * Graph-based Retrieval-Augmented Generation.
 * Extends traditional vector search with a knowledge graph of entities and
 * relationships, enabling both entity-centric (local) and thematic (global)
 * retrieval that outperforms flat cosine similarity for complex questions.
 */

export * from './graph.types';
export * from './knowledge-graph';
export * from './entity-extractor';
export * from './community-detector';
export * from './community-summarizer';
export * from './graph-rag-pipeline';
