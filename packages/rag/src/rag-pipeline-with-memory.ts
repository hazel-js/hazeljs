/**
 * RAG Pipeline with Memory Integration
 */

import { RAGPipeline } from './rag-pipeline';
import { RAGConfig, RAGQueryOptions, RAGResponse, SearchResult } from './types';
import { MemoryManager } from './memory';
import { MemoryType, Message } from './memory/types';

/**
 * Extended RAG response with memory context
 */
export interface RAGResponseWithMemory extends RAGResponse {
  memories: any[];
  conversationHistory: Message[];
}

/**
 * RAG Pipeline enhanced with memory capabilities
 * Combines document retrieval with conversation history and persistent memory
 */
export class RAGPipelineWithMemory extends RAGPipeline {
  private memoryManager: MemoryManager;
  protected llmFunc?: (prompt: string) => Promise<string>;

  constructor(
    config: RAGConfig,
    memoryManager: MemoryManager,
    llmFunction?: (prompt: string) => Promise<string>
  ) {
    super(config, llmFunction);
    this.memoryManager = memoryManager;
    this.llmFunc = llmFunction;
  }

  /**
   * Initialize both RAG and memory systems
   */
  async initialize(): Promise<void> {
    await super.initialize();
    await this.memoryManager.initialize();
  }

  /**
   * Query with memory-enhanced context
   */
  async queryWithMemory(
    query: string,
    sessionId: string,
    userId?: string,
    options?: RAGQueryOptions
  ): Promise<RAGResponseWithMemory> {
    // 1. Store user query in conversation memory
    await this.memoryManager.addMessage(
      {
        role: 'user',
        content: query,
      },
      sessionId,
      userId
    );

    // 2. Retrieve relevant memories
    const memories = await this.memoryManager.relevantMemories(query, {
      sessionId,
      userId,
      types: [MemoryType.CONVERSATION, MemoryType.FACT, MemoryType.ENTITY],
      topK: options?.topK || 5,
    });

    // 3. Get recent conversation history
    const conversationHistory = await this.memoryManager.getConversationHistory(
      sessionId,
      5
    );

    // 4. Perform RAG retrieval
    const ragResults = await this.retrieve(query, options);

    // 5. Build enhanced context
    const context = this.buildEnhancedContext(
      memories,
      conversationHistory,
      ragResults
    );

    // 6. Generate response with LLM
    let answer = '';
    if (this.llmFunc) {
      const prompt = this.buildPromptWithMemory(
        query,
        context,
        conversationHistory,
        options?.llmPrompt
      );
      answer = await this.llmFunc(prompt);
    } else {
      answer = context;
    }

    // 7. Store assistant response in memory
    await this.memoryManager.addMessage(
      {
        role: 'assistant',
        content: answer,
      },
      sessionId,
      userId
    );

    return {
      answer,
      sources: ragResults,
      context,
      memories,
      conversationHistory,
    };
  }

  /**
   * Query with automatic fact extraction and storage
   */
  async queryWithLearning(
    query: string,
    sessionId: string,
    userId?: string,
    options?: RAGQueryOptions
  ): Promise<RAGResponseWithMemory> {
    const response = await this.queryWithMemory(query, sessionId, userId, options);

    // Extract and store important facts from the response
    await this.extractAndStoreFacts(response.answer, sessionId, userId);

    return response;
  }

  /**
   * Clear all memory for a session
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    await this.memoryManager.clearConversation(sessionId);
    await this.memoryManager.clearContext(sessionId);
  }

  /**
   * Get conversation summary
   */
  async getConversationSummary(sessionId: string): Promise<string> {
    return this.memoryManager.summarizeConversation(sessionId);
  }

  /**
   * Store a fact in memory
   */
  async storeFact(
    fact: string,
    sessionId?: string,
    userId?: string
  ): Promise<string> {
    return this.memoryManager.storeFact(fact, {
      sessionId,
      userId,
    });
  }

  /**
   * Recall facts related to a query
   */
  async recallFacts(query: string, topK?: number): Promise<string[]> {
    return this.memoryManager.recallFacts(query, { topK });
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(sessionId?: string) {
    return this.memoryManager.getStats(sessionId);
  }

  /**
   * Build enhanced context combining memories, conversation, and RAG results
   */
  private buildEnhancedContext(
    memories: any[],
    conversationHistory: Message[],
    ragResults: SearchResult[]
  ): string {
    const parts: string[] = [];

    // Add relevant memories
    if (memories.length > 0) {
      parts.push('## Relevant Memories:');
      memories.forEach((m, i) => {
        parts.push(`${i + 1}. ${m.content}`);
      });
      parts.push('');
    }

    // Add recent conversation
    if (conversationHistory.length > 0) {
      parts.push('## Recent Conversation:');
      conversationHistory.forEach((msg) => {
        parts.push(`${msg.role}: ${msg.content}`);
      });
      parts.push('');
    }

    // Add RAG results
    if (ragResults.length > 0) {
      parts.push('## Retrieved Documents:');
      ragResults.forEach((result, i) => {
        parts.push(`${i + 1}. ${result.content}`);
        if (result.metadata?.source) {
          parts.push(`   Source: ${result.metadata.source}`);
        }
      });
    }

    return parts.join('\n');
  }

  /**
   * Build prompt with memory context
   */
  private buildPromptWithMemory(
    query: string,
    context: string,
    conversationHistory: Message[],
    customPrompt?: string
  ): string {
    if (customPrompt) {
      return customPrompt
        .replace('{context}', context)
        .replace('{query}', query)
        .replace(
          '{history}',
          conversationHistory
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')
        );
    }

    return `You are a helpful AI assistant with access to relevant context and conversation history.

${context}

Current Question: ${query}

Please provide a helpful and accurate response based on the above context and conversation history. If the context doesn't contain enough information, say so clearly.

Response:`;
  }

  /**
   * Extract and store important facts from text
   */
  private async extractAndStoreFacts(
    text: string,
    sessionId?: string,
    userId?: string
  ): Promise<void> {
    // Simple fact extraction: sentences that look like statements
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Store sentences that look like facts (not questions, not too short)
      if (
        !trimmed.includes('?') &&
        trimmed.length > 30 &&
        trimmed.length < 200
      ) {
        await this.memoryManager.storeFact(trimmed, {
          sessionId,
          userId,
          extractedFrom: 'response',
        });
      }
    }
  }
}
