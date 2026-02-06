/**
 * RAG Module
 * HazelJS module for RAG functionality
 */

import { HazelModule } from '@hazeljs/core';
import { RAGService, RAGServiceConfig } from './rag.service';
import { RAGModuleOptions } from './decorators/rag.decorator';

export interface RAGModuleConfig extends RAGModuleOptions {
  isGlobal?: boolean;
  vectorStore?: RAGServiceConfig['vectorStore'];
  embeddingProvider?: RAGServiceConfig['embeddingProvider'];
  textSplitter?: RAGServiceConfig['textSplitter'];
  llmFunction?: RAGServiceConfig['llmFunction'];
  topK?: number;
}

@HazelModule({
  providers: [RAGService],
  exports: [RAGService],
})
export class RAGModule {
  private static config: RAGModuleConfig = {};

  /**
   * Configure RAG module with options
   */
  static forRoot(config: RAGModuleConfig = {}): typeof RAGModule {
    RAGModule.config = config;
    return RAGModule;
  }

  /**
   * Get the stored configuration
   */
  static getConfig(): RAGModuleConfig {
    return RAGModule.config;
  }
}
