/**
 * RAG Module
 * HazelJS module for RAG functionality
 */

import { HazelModule } from '@hazeljs/core';
import { RAGService, RAGServiceConfig } from './rag.service';
import { RAGModuleOptions } from './decorators/rag.decorator';
import { MemoryVectorStore } from './vector-stores/memory-vector-store';
import { OpenAIEmbeddings } from './embeddings/openai-embeddings';
import { RecursiveTextSplitter } from './text-splitters/recursive-text-splitter';

export interface RAGModuleConfig extends RAGModuleOptions {
  isGlobal?: boolean;
}

export class RAGModule {
  /**
   * Configure RAG module with options
   */
  static forRoot(config: RAGModuleConfig = {}): typeof ConfiguredRAGModule {
    const {
      vectorDB = 'memory',
      embeddingModel = 'text-embedding-3-small',
      chunkSize = 1000,
      chunkOverlap = 200,
      isGlobal = false,
    } = config;

    // Create embedding provider
    let embeddingProvider;
    if (config.apiKey) {
      embeddingProvider = new OpenAIEmbeddings({
        apiKey: config.apiKey,
        model: embeddingModel,
      });
    }

    // Create vector store based on configuration
    let vectorStore;
    if (vectorDB === 'memory' && embeddingProvider) {
      vectorStore = new MemoryVectorStore(embeddingProvider);
    }
    // TODO: Add other vector store implementations

    // Create text splitter
    const textSplitter = new RecursiveTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    // Create RAG service configuration
    const ragServiceConfig: RAGServiceConfig = {
      vectorStore: vectorStore!,
      embeddingProvider: embeddingProvider!,
      textSplitter,
    };

    @HazelModule({
      providers: [
        {
          provide: RAGService,
          useFactory: () => new RAGService(ragServiceConfig),
        },
      ],
      exports: [RAGService],
      global: isGlobal,
    })
    class ConfiguredRAGModule {}

    return ConfiguredRAGModule;
  }

  /**
   * Configure RAG module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<RAGModuleConfig> | RAGModuleConfig;
    inject?: unknown[];
  }): typeof AsyncConfiguredRAGModule {
    @HazelModule({
      providers: [
        {
          provide: 'RAG_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: RAGService,
          useFactory: async (config: RAGModuleConfig): Promise<RAGService> => {
            // Create providers based on config
            const embeddingProvider = new OpenAIEmbeddings({
              apiKey: config.apiKey || '',
              model: config.embeddingModel || 'text-embedding-3-small',
            });

            const vectorStore = new MemoryVectorStore(embeddingProvider);

            const textSplitter = new RecursiveTextSplitter({
              chunkSize: config.chunkSize || 1000,
              chunkOverlap: config.chunkOverlap || 200,
            });

            const ragService = new RAGService({
              vectorStore,
              embeddingProvider,
              textSplitter,
            });

            await ragService.initialize();
            return ragService;
          },
          inject: ['RAG_CONFIG'],
        },
      ],
      exports: [RAGService],
    })
    class AsyncConfiguredRAGModule {}

    return AsyncConfiguredRAGModule;
  }
}
