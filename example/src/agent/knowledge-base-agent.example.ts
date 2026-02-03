/**
 * Example: Knowledge Base Agent with REST API
 * 
 * Demonstrates:
 * - Agent with RAG integration for knowledge base queries
 * - REST API endpoints for document ingestion
 * - REST API endpoints for asking questions
 * - Memory integration for conversation context
 * - Tool system for document management
 * 
 * Usage:
 * - POST /api/knowledge/ingest - Ingest documents into the knowledge base
 * - POST /api/knowledge/ask - Ask questions to the agent
 * - GET /api/knowledge/documents - List ingested documents
 */

import { Agent, Tool, AgentRuntime, AgentEventType } from '@hazeljs/agent';
import { RAGService, MemoryManager, BufferMemory, MemoryVectorStore, OpenAIEmbeddings, RecursiveTextSplitter } from '@hazeljs/rag';
import { OpenAIProvider } from '@hazeljs/ai';
import { Injectable, Controller, Post, Get, Body, Query, UsePipes, ValidationPipe, logger } from '@hazeljs/core';
import { Swagger, ApiOperation } from '@hazeljs/swagger';

/**
 * Document storage (in production, use a database)
 */
interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Knowledge Base Agent
 * Handles questions about ingested documents using RAG
 */
@Agent({
  name: 'knowledge-base-agent',
  description: 'AI agent for answering questions about ingested documents',
  systemPrompt: `You are a helpful knowledge base assistant. You answer questions based on the documents that have been ingested into the knowledge base.
  
When answering questions:
- Use only information from the retrieved documents
- Cite sources when possible
- If you don't know the answer, say so clearly
- Be concise and accurate
- If multiple documents are relevant, synthesize the information`,
  enableMemory: true,
  enableRAG: true,
  ragTopK: 5,
  maxSteps: 10,
  temperature: 0.7,
})
export class KnowledgeBaseAgent {
  constructor(private ragService: RAGService) {}

  @Tool({
    description: 'Search the knowledge base for relevant documents',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'The search query to find relevant documents',
        required: true,
      },
      {
        name: 'topK',
        type: 'number',
        description: 'Number of documents to retrieve (default: 5)',
        required: false,
      },
    ],
  })
  async searchKnowledgeBase(input: { query: string; topK?: number }) {
    const topK = input.topK || 5;
    
    try {
      const results = await this.ragService.search(input.query, {
        topK,
        includeMetadata: true,
        minScore: 0.5,
      });

      return {
        success: true,
        query: input.query,
        documents: results.map((result) => ({
          id: result.id,
          content: result.content,
          score: result.score,
          metadata: result.metadata || {},
        })),
        totalResults: results.length,
      };
    } catch (error) {
      logger.error('Error searching knowledge base:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
      };
    }
  }

  @Tool({
    description: 'Get a summary of multiple documents',
    parameters: [
      {
        name: 'documents',
        type: 'array',
        description: 'Array of document contents to summarize',
        required: true,
      },
    ],
  })
  async summarizeDocuments(input: { documents: string[] }) {
    // In a real implementation, you might use an LLM to summarize
    const combined = input.documents.join('\n\n---\n\n');
    const summary = combined.substring(0, 500) + '...';
    
    return {
      summary,
      documentCount: input.documents.length,
      totalLength: combined.length,
    };
  }
}

/**
 * DTOs for API requests/responses
 */
export class IngestDocumentDto {
  title!: string;
  content!: string;
  metadata?: Record<string, unknown>;
}

export class AskQuestionDto {
  question!: string;
  sessionId?: string;
  topK?: number;
}

export class DocumentResponseDto {
  id!: string;
  title!: string;
  content!: string;
  metadata?: Record<string, unknown>;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AskQuestionResponseDto {
  answer!: string;
  sources!: Array<{
    id: string;
    title?: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  executionId?: string;
  sessionId?: string;
}

/**
 * Service for managing knowledge base operations
 */
@Injectable()
export class KnowledgeBaseService {
  private documents: Map<string, Document> = new Map();
  private agentRuntime: AgentRuntime;
  private memoryManager: MemoryManager;
  private ragService: RAGService;

  constructor(ragService?: RAGService) {
    // If RAGService is not injected, create it
    if (ragService) {
      this.ragService = ragService;
    } else {
      // Create RAGService for standalone usage
      const embeddings = new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'text-embedding-3-small',
        dimensions: 1536,
      });
      
      const vectorStore = new MemoryVectorStore(embeddings);
      const textSplitter = new RecursiveTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
      });
      
      this.ragService = new RAGService({
        vectorStore,
        embeddingProvider: embeddings,
        textSplitter,
        topK: 5,
      });
    }
    // Initialize agent runtime
    const llmProvider = new OpenAIProvider(process.env.OPENAI_API_KEY || '', {
      defaultModel: 'gpt-4',
    });
    
    this.agentRuntime = new AgentRuntime({
      llmProvider: {
        chat: async (options: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opts = options as any;
          const response = await llmProvider.complete({
            messages: opts.messages,
            temperature: opts.temperature || 0.7,
            functions: opts.tools?.map((tool: unknown) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const t = tool as any;
              return {
                name: t.function?.name || t.name,
                description: t.function?.description || t.description,
                parameters: t.function?.parameters || t.parameters,
              };
            }),
          });
          return {
            content: response.content,
            tool_calls: response.functionCall ? [{
              id: response.id || '',
              type: 'function' as const,
              function: {
                name: response.functionCall.name,
                arguments: response.functionCall.arguments,
              },
            }] : [],
          };
        },
      },
      enableMetrics: true,
      enableCircuitBreaker: true,
    });


    // Register the agent class first
    this.agentRuntime.registerAgent(KnowledgeBaseAgent as any);
    
    // Create agent instance with RAG service dependency
    const agentInstance = new KnowledgeBaseAgent(this.ragService);
    
    // Register the agent instance
    this.agentRuntime.registerAgentInstance('knowledge-base-agent', agentInstance);

    // Initialize memory manager
    const bufferMemory = new BufferMemory({ maxSize: 100 });
    this.memoryManager = new MemoryManager(bufferMemory);

    // Set up event listeners for observability
    this.agentRuntime.on(AgentEventType.EXECUTION_STARTED, (event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      logger.info('Agent execution started', { executionId: e.executionId });
    });

    this.agentRuntime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      logger.info('Agent execution completed', {
        executionId: e.executionId,
        duration: e.data?.duration,
      });
    });

    this.agentRuntime.on(AgentEventType.TOOL_EXECUTION_COMPLETED, (event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;
      logger.debug('Tool executed', {
        toolName: e.data?.toolName,
        duration: e.data?.duration,
      });
    });
  }

  /**
   * Initialize the service (call this before using if RAGService wasn't injected)
   */
  async initialize(): Promise<void> {
    if (this.ragService) {
      try {
        await this.ragService.initialize();
      } catch {
        // Already initialized or no initialize method
      }
    }
  }

  /**
   * Ingest a document into the knowledge base
   */
  async ingestDocument(dto: IngestDocumentDto): Promise<DocumentResponseDto> {
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const document: Document = {
      id: documentId,
      title: dto.title,
      content: dto.content,
      metadata: dto.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    // Store document
    this.documents.set(documentId, document);

    // Index in RAG service
    try {
      const ids = await this.ragService.index({
        content: `${dto.title}\n\n${dto.content}`,
        metadata: {
          id: documentId,
          title: dto.title,
          ...dto.metadata,
        },
      });

      logger.info('Document ingested', {
        documentId,
        ragIds: ids,
        title: dto.title,
      });

      return {
        id: document.id,
        title: document.title,
        content: document.content,
        metadata: document.metadata,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };
    } catch (error) {
      // Remove from storage if indexing failed
      this.documents.delete(documentId);
      logger.error('Failed to index document:', error);
      throw new Error(`Failed to ingest document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ask a question to the agent
   */
  async askQuestion(dto: AskQuestionDto): Promise<AskQuestionResponseDto> {
    const sessionId = dto.sessionId || `session-${Date.now()}`;
    const topK = dto.topK || 5;

    try {
      // Execute agent with question
      const result = await this.agentRuntime.execute(
        'knowledge-base-agent',
        dto.question,
        {
          sessionId,
          enableMemory: true,
          enableRAG: true,
        }
      );

      // Extract sources from tool execution results in steps
      const sources: AskQuestionResponseDto['sources'] = [];
      
      // Look for searchKnowledgeBase tool results in the execution steps
      for (const step of result.steps) {
        if (step.action?.type === 'use_tool' && step.action.toolName === 'searchKnowledgeBase') {
          if (step.result?.output) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const output = step.result.output as any;
            if (output.documents && Array.isArray(output.documents)) {
              for (const doc of output.documents) {
                sources.push({
                  id: doc.id || 'unknown',
                  title: doc.metadata?.title as string || undefined,
                  content: doc.content,
                  score: doc.score || 0,
                  metadata: doc.metadata,
                });
              }
            }
          }
        }
      }

      return {
        answer: result.response || 'I could not generate an answer.',
        sources,
        executionId: result.executionId,
        sessionId,
      };
    } catch (error) {
      logger.error('Error asking question:', error);
      throw new Error(`Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all ingested documents
   */
  async getDocuments(): Promise<DocumentResponseDto[]> {
    return Array.from(this.documents.values()).map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(id: string): Promise<DocumentResponseDto | null> {
    const doc = this.documents.get(id);
    if (!doc) return null;

    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);
    // In production, also remove from RAG index
    logger.info('Document deleted', { documentId: id });
    return true;
  }
}

/**
 * REST API Controller
 */
@Swagger({
  title: 'Knowledge Base API',
  description: 'API for ingesting documents and asking questions using AI agent with RAG',
  version: '1.0.0',
  tags: [
    {
      name: 'knowledge',
      description: 'Knowledge base operations',
    },
  ],
})
@Controller({
  path: 'knowledge',
})
export class KnowledgeBaseController {
  constructor(private knowledgeBaseService: KnowledgeBaseService) {}

  @Post('/ingest')
  @ApiOperation({
    summary: 'Ingest a document into the knowledge base',
    description: 'Adds a document to the knowledge base and indexes it for semantic search',
    tags: ['knowledge'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'content'],
            properties: {
              title: {
                type: 'string',
                example: 'Getting Started with HazelJS',
              },
              content: {
                type: 'string',
                example: 'HazelJS is a powerful framework for building AI-native applications...',
              },
              metadata: {
                type: 'object',
                example: { category: 'documentation', author: 'John Doe' },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': {
        description: 'Document ingested successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'doc-1234567890-abc123' },
                title: { type: 'string', example: 'Getting Started with HazelJS' },
                content: { type: 'string' },
                metadata: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid request body',
      },
      '500': {
        description: 'Failed to ingest document',
      },
    },
  })
  @UsePipes(ValidationPipe)
  async ingestDocument(@Body() dto: IngestDocumentDto): Promise<DocumentResponseDto> {
    logger.info('Ingesting document', { title: dto.title });
    return this.knowledgeBaseService.ingestDocument(dto);
  }

  @Post('/ask')
  @ApiOperation({
    summary: 'Ask a question to the knowledge base agent',
    description: 'Uses the AI agent with RAG to answer questions based on ingested documents',
    tags: ['knowledge'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['question'],
            properties: {
              question: {
                type: 'string',
                example: 'What is HazelJS and how do I get started?',
              },
              sessionId: {
                type: 'string',
                example: 'session-123',
              },
              topK: {
                type: 'number',
                example: 5,
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Question answered successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                answer: {
                  type: 'string',
                  example: 'HazelJS is a framework for building AI-native applications...',
                },
                sources: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      score: { type: 'number' },
                      metadata: { type: 'object' },
                    },
                  },
                },
                executionId: { type: 'string' },
                sessionId: { type: 'string' },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid request body',
      },
      '500': {
        description: 'Failed to process question',
      },
    },
  })
  @UsePipes(ValidationPipe)
  async askQuestion(@Body() dto: AskQuestionDto): Promise<AskQuestionResponseDto> {
    logger.info('Asking question', { question: dto.question, sessionId: dto.sessionId });
    return this.knowledgeBaseService.askQuestion(dto);
  }

  @Get('/documents')
  @ApiOperation({
    summary: 'List all ingested documents',
    description: 'Returns a list of all documents that have been ingested into the knowledge base',
    tags: ['knowledge'],
    responses: {
      '200': {
        description: 'List of documents',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getDocuments(): Promise<DocumentResponseDto[]> {
    return this.knowledgeBaseService.getDocuments();
  }

  @Get('/documents/:id')
  @ApiOperation({
    summary: 'Get a specific document by ID',
    description: 'Returns details of a specific document',
    tags: ['knowledge'],
    responses: {
      '200': {
        description: 'Document details',
      },
      '404': {
        description: 'Document not found',
      },
    },
  })
  async getDocument(@Query('id') id: string): Promise<DocumentResponseDto | null> {
    return this.knowledgeBaseService.getDocument(id);
  }
}

/**
 * Standalone demo function
 * Run this directly: npx ts-node src/agent/knowledge-base-agent.example.ts
 */
export async function demo() {
  console.log('🚀 Knowledge Base Agent Demo\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    console.log('\nPlease set your OpenAI API key:');
    console.log('  export OPENAI_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  // Setup RAG service
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
    dimensions: 1536,
  });
  
  const vectorStore = new MemoryVectorStore(embeddings);
  const textSplitter = new RecursiveTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  
  const ragService = new RAGService({
    vectorStore,
    embeddingProvider: embeddings,
    textSplitter,
    topK: 5,
  });
  
  await ragService.initialize();

  // Create service and demo
  const service = new KnowledgeBaseService(ragService);
  await service.initialize();

  console.log('📚 Ingesting sample documents...\n');

  // Ingest sample documents
  const doc1 = await service.ingestDocument({
    title: 'HazelJS Overview',
    content: `HazelJS is a modern, TypeScript-first framework for building scalable backend applications. 
    It provides a modular architecture with built-in support for dependency injection, decorators, and middleware.
    The framework includes powerful features like service discovery, distributed caching, microservices support, and AI integration.`,
    metadata: { category: 'documentation', source: 'intro' },
  });
  console.log(`✅ Ingested: ${doc1.title}`);

  const doc2 = await service.ingestDocument({
    title: 'Agent Runtime',
    content: `The Agent Runtime is a production-grade execution engine for stateful AI agents. 
    It provides controlled execution loops, state persistence, tool orchestration, memory integration, and comprehensive observability.
    Agents can use tools, maintain conversation context, and integrate with RAG for knowledge retrieval.`,
    metadata: { category: 'documentation', source: 'agent' },
  });
  console.log(`✅ Ingested: ${doc2.title}`);

  const doc3 = await service.ingestDocument({
    title: 'RAG Integration',
    content: `Retrieval-Augmented Generation (RAG) allows agents to search knowledge bases and retrieve relevant context.
    HazelJS provides comprehensive RAG capabilities with support for vector databases like Pinecone, Weaviate, Qdrant, and ChromaDB.
    Agents can automatically retrieve relevant documents before answering questions.`,
    metadata: { category: 'documentation', source: 'rag' },
  });
  console.log(`✅ Ingested: ${doc3.title}\n`);

  // Ask questions
  const questions = [
    'What is HazelJS?',
    'What is the Agent Runtime?',
    'How does RAG work with agents?',
  ];

  for (const question of questions) {
    console.log(`${'='.repeat(60)}`);
    console.log(`❓ Question: "${question}"`);
    console.log('='.repeat(60));

    const result = await service.askQuestion({
      question,
      sessionId: 'demo-session',
    });

    console.log(`\n💬 Answer: ${result.answer}\n`);
    
    if (result.sources.length > 0) {
      console.log('📚 Sources:');
      result.sources.forEach((source, idx) => {
        console.log(`  ${idx + 1}. ${source.title || 'Untitled'} (score: ${source.score.toFixed(3)})`);
      });
    }
    console.log();
  }

  // List all documents
  console.log('📋 All Documents:');
  const documents = await service.getDocuments();
  documents.forEach((doc, idx) => {
    console.log(`  ${idx + 1}. ${doc.title} (${doc.id})`);
  });

  console.log('\n✅ Demo completed!\n');
  console.log('💡 To use via REST API:');
  console.log('   1. Start the server: npm run start');
  console.log('   2. POST /api/knowledge/ingest - Ingest documents');
  console.log('   3. POST /api/knowledge/ask - Ask questions');
  console.log('   4. GET /api/knowledge/documents - List documents');
}

// Run demo if executed directly
if (require.main === module) {
  demo().catch((error) => {
    console.error('❌ Error running demo:', error);
    process.exit(1);
  });
}

/**
 * REST API Usage:
 * 
 * // 1. Ingest documents
 * POST /api/knowledge/ingest
 * {
 *   "title": "HazelJS Overview",
 *   "content": "HazelJS is a framework for building AI-native applications...",
 *   "metadata": { "category": "documentation" }
 * }
 * 
 * // 2. Ask questions
 * POST /api/knowledge/ask
 * {
 *   "question": "What is HazelJS?",
 *   "sessionId": "user-123"
 * }
 * 
 * // 3. List documents
 * GET /api/knowledge/documents
 */
