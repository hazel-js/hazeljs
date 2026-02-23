/**
 * Response handler types - for Agent, RAG, and external integrations
 */
import type { IncomingMessage } from './message.types';
import type { ConversationTurn } from '../store/conversation-context.interface';

/** Minimal RAG search interface - compatible with @hazeljs/rag RAGService */
export interface IRAGSearch {
  search(
    query: string,
    options?: { topK?: number; minScore?: number }
  ): Promise<
    Array<{ id?: string; content: string; score?: number; metadata?: Record<string, unknown> }>
  >;
}

/** Result from agent/external handler - can include sources for citations */
export interface AgentHandlerResult {
  response: string;
  sources?: Array<{
    id?: string;
    content: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
}

/** Input for agent handler - CSR-style integration */
export interface AgentHandlerInput {
  message: IncomingMessage;
  sessionId: string;
  conversationTurns: ConversationTurn[];
}

/**
 * Agent handler - wire your CSRService, AgentRuntime, or custom logic.
 * Return response string or { response, sources }.
 *
 * @example
 * ```ts
 * agentHandler: async ({ message, sessionId }) => {
 *   const result = await csrService.chat(message.text, sessionId, message.userId);
 *   return { response: result.response, sources: result.sources };
 * }
 * ```
 */
export type AgentHandler = (input: AgentHandlerInput) => Promise<string | AgentHandlerResult>;
