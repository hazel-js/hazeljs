import { Controller, Get, Post, Body } from '@hazeljs/core';
import { AIFunction, AIPrompt } from '@hazeljs/ai';
import { AnthropicProvider } from '@hazeljs/ai';
import { GeminiProvider } from '@hazeljs/ai';
import { CohereProvider } from '@hazeljs/ai';
import { VectorService } from '@hazeljs/ai';
import { Swagger, ApiOperation } from '@hazeljs/swagger';

/**
 * Enhanced AI controller demonstrating multiple AI providers
 */
@Controller('/ai-enhanced')
@Swagger({
  title: 'Enhanced AI API',
  description: 'Endpoints demonstrating multiple AI providers and vector search',
  version: '1.0.0',
  tags: [{ name: 'ai-enhanced', description: 'Enhanced AI operations' }],
})
export class AIEnhancedController {
  private anthropic: AnthropicProvider;
  private gemini: GeminiProvider;
  private cohere: CohereProvider;
  private vectorService: VectorService;

  constructor() {
    this.anthropic = new AnthropicProvider();
    this.gemini = new GeminiProvider();
    this.cohere = new CohereProvider();
    this.vectorService = new VectorService();

    // Initialize vector service
    this.vectorService.initialize({
      database: 'pinecone',
      index: 'hazeljs-demo',
    });
  }

  /**
   * Generate content with Claude
   */
  @Post('/claude/generate')
  @ApiOperation({
    summary: 'Generate content with Anthropic Claude',
    description: 'Uses Claude AI model for content generation',
    tags: ['ai-enhanced'],
  })
  async generateWithClaude(@Body() body: { prompt: string }) {
    const response = await this.anthropic.complete({
      messages: [{ role: 'user', content: body.prompt }],
      model: 'claude-3-opus-20240229',
    });

    return {
      provider: 'anthropic',
      model: response.model,
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Stream content with Claude
   */
  @Post('/claude/stream')
  @ApiOperation({
    summary: 'Stream content with Claude',
    description: 'Streaming response from Claude AI',
    tags: ['ai-enhanced'],
  })
  async streamWithClaude(@Body() body: { prompt: string }) {
    const chunks: string[] = [];

    for await (const chunk of this.anthropic.streamComplete({
      messages: [{ role: 'user', content: body.prompt }],
    })) {
      chunks.push(chunk.delta);
    }

    return {
      provider: 'anthropic',
      chunks,
      fullContent: chunks.join(''),
    };
  }

  /**
   * Generate content with Gemini
   */
  @Post('/gemini/generate')
  @ApiOperation({
    summary: 'Generate content with Google Gemini',
    description: 'Uses Gemini AI model for content generation',
    tags: ['ai-enhanced'],
  })
  async generateWithGemini(@Body() body: { prompt: string }) {
    const response = await this.gemini.complete({
      messages: [{ role: 'user', content: body.prompt }],
      model: 'gemini-pro',
    });

    return {
      provider: 'gemini',
      model: response.model,
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Generate content with Cohere
   */
  @Post('/cohere/generate')
  @ApiOperation({
    summary: 'Generate content with Cohere',
    description: 'Uses Cohere Command model for content generation',
    tags: ['ai-enhanced'],
  })
  async generateWithCohere(@Body() body: { prompt: string }) {
    const response = await this.cohere.complete({
      messages: [{ role: 'user', content: body.prompt }],
      model: 'command',
    });

    return {
      provider: 'cohere',
      model: response.model,
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Generate embeddings with Gemini
   */
  @Post('/embeddings/gemini')
  @ApiOperation({
    summary: 'Generate embeddings with Gemini',
    description: 'Create vector embeddings for text',
    tags: ['ai-enhanced'],
  })
  async generateEmbeddings(@Body() body: { texts: string[] }) {
    const response = await this.gemini.embed({
      input: body.texts,
      model: 'embedding-001',
    });

    return {
      provider: 'gemini',
      model: response.model,
      count: response.embeddings.length,
      dimensions: response.embeddings[0]?.length || 0,
      usage: response.usage,
    };
  }

  /**
   * Generate embeddings with Cohere
   */
  @Post('/embeddings/cohere')
  @ApiOperation({
    summary: 'Generate embeddings with Cohere',
    description: 'Create vector embeddings for text using Cohere',
    tags: ['ai-enhanced'],
  })
  async generateCohereEmbeddings(@Body() body: { texts: string[] }) {
    const response = await this.cohere.embed({
      input: body.texts,
      model: 'embed-english-v3.0',
    });

    return {
      provider: 'cohere',
      model: response.model,
      count: response.embeddings.length,
      dimensions: response.embeddings[0]?.length || 0,
      usage: response.usage,
    };
  }

  /**
   * Rerank documents with Cohere
   */
  @Post('/cohere/rerank')
  @ApiOperation({
    summary: 'Rerank documents with Cohere',
    description: 'Rerank documents based on relevance to query',
    tags: ['ai-enhanced'],
  })
  async rerankDocuments(@Body() body: { query: string; documents: string[]; topN?: number }) {
    const results = await this.cohere.rerank(body.query, body.documents, body.topN);

    return {
      provider: 'cohere',
      query: body.query,
      results,
    };
  }

  /**
   * Add documents to vector store
   */
  @Post('/vector/upsert')
  @ApiOperation({
    summary: 'Add documents to vector store',
    description: 'Upsert documents into vector database',
    tags: ['ai-enhanced'],
  })
  async upsertDocuments(
    @Body() body: { documents: Array<{ id: string; content: string; metadata?: any }> }
  ) {
    await this.vectorService.upsert(body.documents);

    return {
      message: 'Documents upserted successfully',
      count: body.documents.length,
    };
  }

  /**
   * Search vector store
   */
  @Post('/vector/search')
  @ApiOperation({
    summary: 'Search vector store',
    description: 'Semantic search in vector database',
    tags: ['ai-enhanced'],
  })
  async searchVectors(@Body() body: { query: string; topK?: number }) {
    const results = await this.vectorService.search({
      query: body.query,
      topK: body.topK || 5,
    });

    return {
      query: body.query,
      results,
      count: results.length,
    };
  }

  /**
   * Get vector store statistics
   */
  @Get('/vector/stats')
  @ApiOperation({
    summary: 'Get vector store statistics',
    description: 'Get statistics about the vector database',
    tags: ['ai-enhanced'],
  })
  async getVectorStats() {
    const stats = await this.vectorService.getStats();

    return {
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Compare AI providers
   */
  @Post('/compare')
  @ApiOperation({
    summary: 'Compare AI providers',
    description: 'Generate content with all providers and compare results',
    tags: ['ai-enhanced'],
  })
  async compareProviders(@Body() body: { prompt: string }) {
    const [claude, gemini, cohere] = await Promise.all([
      this.anthropic.complete({
        messages: [{ role: 'user', content: body.prompt }],
      }),
      this.gemini.complete({
        messages: [{ role: 'user', content: body.prompt }],
      }),
      this.cohere.complete({
        messages: [{ role: 'user', content: body.prompt }],
      }),
    ]);

    return {
      prompt: body.prompt,
      providers: {
        anthropic: {
          model: claude.model,
          content: claude.content,
          usage: claude.usage,
        },
        gemini: {
          model: gemini.model,
          content: gemini.content,
          usage: gemini.usage,
        },
        cohere: {
          model: cohere.model,
          content: cohere.content,
          usage: cohere.usage,
        },
      },
    };
  }
}
