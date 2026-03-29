import { Controller, Post, Get, Body, Service } from '@hazeljs/core';
import { OpenAIEmbeddings } from '@hazeljs/rag';
import { PrismaClient } from '@prisma/client';

@Service()
export class RAGService {
  private embeddings: OpenAIEmbeddings;
  private prisma: PrismaClient;

  constructor() {
    // Initialize embeddings for generating vectors
    this.embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'text-embedding-3-small',
    });
    
    // Initialize Prisma for PostgreSQL storage
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    await this.prisma.$connect();
    const count = await this.prisma.document.count();
    console.log(`RAG Service initialized - PostgreSQL vector store ready with ${count} documents`);
  }
  
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  async ingestDocument(content: string, metadata?: any) {
    console.log(`Ingesting document, content length: ${content.length}`);
    
    // Generate embedding for the document
    const embedding = await this.embeddings.embed(content);
    
    // Store in PostgreSQL
    const document = await this.prisma.document.create({
      data: {
        content,
        embedding,
        metadata: {
          source: 'user-input',
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      },
    });
    
    const totalDocuments = await this.prisma.document.count();
    console.log(`Document ingested successfully. ID: ${document.id}, Total documents: ${totalDocuments}`);
    
    return { 
      id: document.id, 
      message: 'Document ingested successfully and stored in PostgreSQL',
      totalDocuments
    };
  }

  async search(query: string, topK = 5) {
    const totalDocuments = await this.prisma.document.count();
    console.log(`RAG search requested for: "${query}". Total documents: ${totalDocuments}`);
    
    // Generate embedding for the query
    const queryVector = await this.embeddings.embed(query);
    
    // Perform vector similarity search using raw SQL for cosine similarity
    // Note: We don't select the embedding column to avoid deserialization issues
    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      content: string;
      metadata: any;
      similarity: number;
    }>>`
      SELECT 
        id,
        content,
        metadata,
        (1 - (embedding <=> ${queryVector}::vector)) as similarity
      FROM documents
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT ${topK}
    `;
    
    console.log(`RAG search for "${query}" returned ${results.length} results`);
    
    return results.map(result => ({
      id: result.id,
      content: result.content,
      score: result.similarity,
      metadata: result.metadata,
    }));
  }
  
  async getDocumentCount() {
    const totalDocuments = await this.prisma.document.count();
    return { totalDocuments };
  }
  
  async getAllDocuments() {
    const documents = await this.prisma.document.findMany({
      select: {
        id: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return documents;
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
    const stats = await this.ragService.getDocumentCount();
    return { 
      message: 'RAG service is ready - PostgreSQL vector store with persistent storage',
      ...stats,
      endpoints: {
        ingest: 'POST /rag/ingest - Add documents to PostgreSQL',
        search: 'POST /rag/search - Search documents with vector similarity',
        stats: 'GET /rag/stats - Get document count',
        list: 'GET /rag/list - List all documents'
      }
    };
  }
  
  @Get('stats')
  async getStats() {
    return this.ragService.getDocumentCount();
  }
  
  @Get('list')
  async listDocuments() {
    const documents = await this.ragService.getAllDocuments();
    return { 
      documents,
      total: documents.length
    };
  }
}
