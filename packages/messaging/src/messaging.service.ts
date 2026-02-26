/**
 * Messaging Service - LLM/Agent-powered bot response generation
 * Uses IConversationContextStore (memory or Redis) for horizontally scalable context
 * Supports: plain LLM, RAG-augmented, Agent (tools + RAG like CSR), custom handler
 */
import { Injectable } from '@hazeljs/core';
import type { IncomingMessage } from './types/message.types';
import type { IAIProvider } from '@hazeljs/ai';
import type { AIMessage } from '@hazeljs/ai';
import type { IConversationContextStore } from './store/conversation-context.interface';
import { MemoryConversationContextStore } from './store/memory-conversation-context';
import type { AgentHandler, IRAGSearch } from './types/response-handler.types';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, friendly assistant in a messaging app. 
Keep responses concise and conversational. Adapt your tone to be natural for chat.`;

const RAG_CONTEXT_PREFIX = `Use the following context from the knowledge base to answer. 
If the context doesn't contain relevant information, say so. Cite sources when helpful.\n\n---\n`;

export interface MessagingServiceOptions {
  /** AI provider for LLM responses */
  aiProvider?: IAIProvider;
  /** System prompt for the bot */
  systemPrompt?: string;
  /** Model name (provider-specific) */
  model?: string;
  /** Temperature 0-1 */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
  /** Max conversation turns to keep in context */
  maxContextTurns?: number;
  /** Custom handler - overrides everything when provided */
  customHandler?: (msg: IncomingMessage) => Promise<string> | string;
  /** Agent handler - CSR-style: tools, RAG, external APIs (e.g. csrService.chat) */
  agentHandler?: AgentHandler;
  /** RAG service - augments LLM with knowledge base search (when not using agentHandler) */
  ragService?: IRAGSearch;
  /** Number of RAG docs to retrieve (default: 5) */
  ragTopK?: number;
  /** Min similarity score for RAG results (0-1, default: 0.5) */
  ragMinScore?: number;
  /** Context store - defaults to memory; use Redis for horizontal scaling */
  contextStore?: IConversationContextStore;
}

@Injectable()
export class MessagingService {
  private options: Required<
    Omit<
      MessagingServiceOptions,
      'aiProvider' | 'customHandler' | 'contextStore' | 'agentHandler' | 'ragService'
    >
  > &
    Pick<
      MessagingServiceOptions,
      'aiProvider' | 'customHandler' | 'contextStore' | 'agentHandler' | 'ragService'
    >;

  private store: IConversationContextStore;

  constructor(options: MessagingServiceOptions = {}, contextStore?: IConversationContextStore) {
    this.options = {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500,
      maxContextTurns: 10,
      ragTopK: 5,
      ragMinScore: 0.5,
      ...options,
    };
    this.store = contextStore ?? options.contextStore ?? new MemoryConversationContextStore();
  }

  /** Generate bot response for an incoming message */
  async handleMessage(message: IncomingMessage): Promise<string> {
    const store = this.store;
    const sessionId = message.sessionId ?? `default:${message.channel}:${message.userId}`;

    if (this.options.customHandler) {
      const reply = await Promise.resolve(this.options.customHandler(message));
      await store.appendTurn(
        sessionId,
        { role: 'user', content: message.text },
        this.options.maxContextTurns
      );
      if (reply) {
        await store.appendTurn(
          sessionId,
          { role: 'assistant', content: reply },
          this.options.maxContextTurns
        );
      }
      return reply;
    }

    if (this.options.agentHandler) {
      await store.appendTurn(
        sessionId,
        { role: 'user', content: message.text },
        this.options.maxContextTurns
      );
      const turns = await store.getTurns(sessionId);
      const result = await this.options.agentHandler({
        message,
        sessionId,
        conversationTurns: turns,
      });
      const reply = typeof result === 'string' ? result : result.response;
      if (reply) {
        await store.appendTurn(
          sessionId,
          { role: 'assistant', content: reply },
          this.options.maxContextTurns
        );
      }
      return reply;
    }

    const provider = this.options.aiProvider;
    if (!provider) {
      throw new Error(
        'MessagingService requires aiProvider, agentHandler, or customHandler. Configure via MessagingModule.forRoot().'
      );
    }

    await store.appendTurn(
      sessionId,
      { role: 'user', content: message.text },
      this.options.maxContextTurns
    );
    const turns = await store.getTurns(sessionId);

    let systemPrompt = this.options.systemPrompt;

    if (this.options.ragService) {
      const results = await this.options.ragService.search(message.text, {
        topK: this.options.ragTopK,
        minScore: this.options.ragMinScore,
      } as { topK?: number; minScore?: number });
      if (results.length > 0) {
        const context = results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
        systemPrompt = `${systemPrompt}\n\n${RAG_CONTEXT_PREFIX}Context:\n${context}\n---\n`;
      }
    }

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ];

    const response = await provider.complete({
      messages,
      model: this.options.model,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
    });

    const reply = response.content?.trim() ?? 'I could not generate a response.';

    await store.appendTurn(
      sessionId,
      { role: 'assistant', content: reply },
      this.options.maxContextTurns
    );

    return reply;
  }

  /** Clear conversation history for a session */
  async clearSession(sessionId: string): Promise<void> {
    await this.store.clearSession(sessionId);
  }

  /** Get current options */
  getOptions(): MessagingServiceOptions {
    return { ...this.options };
  }
}
