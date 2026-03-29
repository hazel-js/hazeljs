import { Controller, Post, Get, Body, Service } from '@hazeljs/core';
import { AgenticRAGService, MemoryVectorStore, OpenAIEmbeddings, Document } from '@hazeljs/rag';

@Service()
export class RAGService {
  private ragService: AgenticRAGService;
  private vectorStore: MemoryVectorStore;

  constructor() {
    // Initialize embeddings and vector store
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
    });
    this.vectorStore = new MemoryVectorStore(embeddings);
    
    // Initialize RAG service
    this.ragService = new AgenticRAGService({
      vectorStore: this.vectorStore,
      enableAllFeatures: true,
    });
  }

  async onModuleInit() {
    await this.vectorStore.initialize();
  }

  async ingestDocument(content: string, metadata?: any) {
    const document: Document = {
      id: `doc-${Date.now()}`,
      content,
      metadata: {
        source: 'user-input',
        timestamp: new Date(),
        ...metadata,
      },
    };
    
    await this.vectorStore.addDocuments([document]);
    return { id: document.id, content: 'Document ingested successfully' };
  }

  async search(query: string) {
    const results = await this.ragService.retrieve(query, {
      topK: 5,
    });
    
    return results.map(result => ({
      content: result.content,
      score: result.score,
      metadata: result.metadata,
    }));
  }
}

@Controller('rag')
export class RAGController {
  constructor(private readonly ragService: RAGService) {}

  @Post('ingest')
  async ingestDocument(@Body() body: { content: string; metadata?: any }) {
    const result = await this.ragService.ingestDocument(body.content, body.metadata);
    return result;
  }

  @Post('search')
  async search(@Body() body: { query: string }) {
    const results = await this.ragService.search(body.query);
    return { results };
  }

  @Get('documents')
  async getDocuments() {
    return { 
      message: 'RAG service is ready - use /ingest to add documents and /search to query them',
      endpoints: {
        ingest: 'POST /rag/ingest - Add documents',
        search: 'POST /rag/search - Search documents'
      }
    };
  }
}
