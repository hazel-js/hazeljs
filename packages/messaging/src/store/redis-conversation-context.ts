/**
 * Redis-backed conversation context - horizontally scalable
 */
import type { IConversationContextStore, ConversationTurn } from './conversation-context.interface';

const KEY_PREFIX = 'messaging:context:';
const DEFAULT_TTL_SEC = 86400; // 24h

export interface RedisConversationContextConfig {
  /** Redis client (ioredis) */
  client: {
    get: (k: string) => Promise<string | null>;
    setex: (k: string, t: number, v: string) => Promise<string>;
    del: (k: string) => Promise<number>;
  };
  /** TTL for context keys in seconds (default: 24h) */
  ttlSeconds?: number;
}

export class RedisConversationContextStore implements IConversationContextStore {
  private client: RedisConversationContextConfig['client'];
  private ttl: number;

  constructor(config: RedisConversationContextConfig) {
    this.client = config.client;
    this.ttl = config.ttlSeconds ?? DEFAULT_TTL_SEC;
  }

  private key(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  async getTurns(sessionId: string): Promise<ConversationTurn[]> {
    const raw = await this.client.get(this.key(sessionId));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ConversationTurn[];
    } catch {
      return [];
    }
  }

  async appendTurn(sessionId: string, turn: ConversationTurn, maxTurns?: number): Promise<void> {
    const turns = await this.getTurns(sessionId);
    turns.push(turn);
    const trimmed = maxTurns && turns.length > maxTurns * 2 ? turns.slice(-(maxTurns * 2)) : turns;
    const k = this.key(sessionId);
    await this.client.setex(k, this.ttl, JSON.stringify(trimmed));
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.client.del(this.key(sessionId));
  }
}
