/**
 * Decorator-based RAG Example
 * Demonstrates the decorator API from the roadmap
 */

import {
  RAG,
  Embeddable,
  VectorColumn,
  SemanticSearch,
  HybridSearch,
  AutoEmbed,
  RAGService,
} from '@hazeljs/rag';
import { Injectable, Controller, Get, Post, Body, Query } from '@hazeljs/core';

// Example 1: Embeddable Entity
@Embeddable({
  fields: ['title', 'description', 'content'],
  strategy: 'concat',
  model: 'text-embedding-3-small',
})
class Article {
  id!: string;
  title!: string;
  description!: string;
  content!: string;

  @VectorColumn()
  embedding!: number[];

  createdAt!: Date;
}

// Example 2: Repository with Semantic Search
@Injectable()
class ArticleRepository {
  constructor(private ragService: RAGService) {}

  @SemanticSearch()
  async findSimilar(query: string, limit = 10) {
    return this.ragService.search(query, { topK: limit });
  }

  @HybridSearch({ vectorWeight: 0.7, keywordWeight: 0.3 })
  async hybridSearch(query: string) {
    return this.ragService.hybridSearch(query, {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    });
  }
}

// Example 3: Document Controller with Auto-Embed
@Controller('/documents')
class DocumentController {
  constructor(private ragService: RAGService) {}

  @Post()
  @AutoEmbed()
  async uploadDocument(@Body() doc: { title: string; content: string }) {
    // Document automatically chunked and embedded
    const ids = await this.ragService.index({
      content: `${doc.title}\n\n${doc.content}`,
      metadata: { title: doc.title, type: 'document' },
    });

    return { success: true, ids };
  }

  @Get('/search')
  @SemanticSearch()
  async search(@Query('q') query: string) {
    const results = await this.ragService.search(query, {
      topK: 5,
      minScore: 0.7,
      includeMetadata: true,
    });

    return { query, results };
  }

  @Post('/ask')
  async askQuestion(@Body() body: { question: string }) {
    // Full RAG pipeline: retrieve + generate
    const { answer, sources } = await this.ragService.ask(body.question, {
      topK: 3,
    });

    return { answer, sources };
  }
}

// Example 4: Knowledge Service with Advanced Patterns
@Injectable()
class KnowledgeService {
  constructor(private ragService: RAGService) {}

  // Multi-query retrieval
  async advancedSearch(question: string) {
    return this.ragService.multiQuery(question, 3);
  }

  // Contextual compression
  async compressedRAG(question: string) {
    const docs = await this.ragService.retrieve(question, { topK: 10 });
    const compressed = await this.ragService.compress(docs, question);
    return this.ragService.generate(question, compressed);
  }

  // Self-query with metadata filtering
  async smartQuery(naturalLanguageQuery: string) {
    // "Find articles about TypeScript from 2024"
    // Automatically extracts filters
    return this.ragService.selfQuery(naturalLanguageQuery);
  }

  // Time-weighted retrieval
  async recentBiasedSearch(query: string) {
    return this.ragService.timeWeighted(query, 0.01);
  }
}

// Example Usage Demo
async function demonstrateDecoratorAPI() {
  console.log('🎨 Decorator-based RAG API Demo\n');

  console.log('✅ Features Demonstrated:');
  console.log('  1. @Embeddable - Automatic entity embedding');
  console.log('  2. @VectorColumn - Vector storage');
  console.log('  3. @SemanticSearch - Semantic search decorator');
  console.log('  4. @HybridSearch - Hybrid search decorator');
  console.log('  5. @AutoEmbed - Automatic embedding generation');
  console.log('  6. Advanced RAG patterns (multi-query, compression, etc.)');
  console.log('');

  console.log('📚 Example Entity:');
  console.log(`
@Embeddable({
  fields: ['title', 'description', 'content'],
  strategy: 'concat',
  model: 'text-embedding-3-small'
})
class Article {
  @VectorColumn()
  embedding: number[];
}
  `);

  console.log('🔍 Example Repository:');
  console.log(`
@Injectable()
class ArticleRepository {
  @SemanticSearch()
  async findSimilar(query: string, limit = 10) {
    return this.ragService.search(query, { topK: limit });
  }
  
  @HybridSearch({ vectorWeight: 0.7, keywordWeight: 0.3 })
  async hybridSearch(query: string) {
    return this.ragService.hybridSearch(query);
  }
}
  `);

  console.log('🎯 Example Controller:');
  console.log(`
@Controller('/documents')
class DocumentController {
  @Post()
  @AutoEmbed()
  async uploadDocument(@Body() doc: DocumentDto) {
    return this.ragService.index(doc);
  }
  
  @Get('/search')
  @SemanticSearch()
  async search(@Query('q') query: string) {
    return this.ragService.search(query, {
      topK: 5,
      minScore: 0.7,
      includeMetadata: true
    });
  }
}
  `);

  console.log('\n✨ This demonstrates the full decorator-based API from the roadmap!');
  console.log('📖 See the roadmap for complete implementation details.');
}

if (require.main === module) {
  demonstrateDecoratorAPI().catch(console.error);
}

export {
  Article,
  ArticleRepository,
  DocumentController,
  KnowledgeService,
  demonstrateDecoratorAPI,
};
