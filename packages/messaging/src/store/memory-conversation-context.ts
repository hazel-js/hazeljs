/**
 * In-memory conversation context - for dev/single-instance only
 */
import type { IConversationContextStore, ConversationTurn } from './conversation-context.interface';

export class MemoryConversationContextStore implements IConversationContextStore {
  private history = new Map<string, ConversationTurn[]>();

  async getTurns(sessionId: string): Promise<ConversationTurn[]> {
    return this.history.get(sessionId) ?? [];
  }

  async appendTurn(sessionId: string, turn: ConversationTurn, maxTurns?: number): Promise<void> {
    const turns = this.history.get(sessionId) ?? [];
    turns.push(turn);
    const trimmed = maxTurns && turns.length > maxTurns * 2 ? turns.slice(-(maxTurns * 2)) : turns;
    this.history.set(sessionId, trimmed);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.history.delete(sessionId);
  }
}
