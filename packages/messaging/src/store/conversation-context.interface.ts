/**
 * Conversation context store - abstract storage for multi-turn history
 * Implementations: memory (dev), Redis (production, horizontally scalable)
 */

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface IConversationContextStore {
  /** Get conversation turns for a session */
  getTurns(sessionId: string): Promise<ConversationTurn[]>;

  /** Append turn and optionally trim to max count */
  appendTurn(sessionId: string, turn: ConversationTurn, maxTurns?: number): Promise<void>;

  /** Clear session history */
  clearSession(sessionId: string): Promise<void>;
}
