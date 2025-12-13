/**
 * RAG Module
 * HazelJS module for RAG functionality
 */

import { HazelModule } from '@hazeljs/core';
import { RAGService } from './rag.service';
import { RAGModuleOptions } from './decorators/rag.decorator';

export interface RAGModuleConfig extends RAGModuleOptions {
  isGlobal?: boolean;
}

export class RAGModule {
  /**
   * Configure RAG module with options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static forRoot(_config: RAGModuleConfig = {}): any {
    // TODO: Use config to initialize RAG service with proper providers
    // For now, RAGService will need to be configured separately

    @HazelModule({
      providers: [RAGService],
      exports: [RAGService],
    })
    class ConfiguredRAGModule {}

    return ConfiguredRAGModule;
  }

  /**
   * Configure RAG module asynchronously
   */
  static forRootAsync(_options: {
    useFactory: (...args: unknown[]) => Promise<RAGModuleConfig> | RAGModuleConfig;
    inject?: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): any {
    @HazelModule({
      providers: [RAGService],
      exports: [RAGService],
    })
    class AsyncConfiguredRAGModule {}

    return AsyncConfiguredRAGModule;
  }
}
