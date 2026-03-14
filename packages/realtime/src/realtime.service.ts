/**
 * RealtimeService - manages realtime voice sessions and provider config
 */

import { Service } from '@hazeljs/core';
import { OpenAIRealtimeSession, type RealtimeClientAdapter } from './providers/openai';
import type { RealtimeProvider, RealtimeSessionConfig } from './realtime.types';

export interface RealtimeServiceOptions {
  defaultProvider?: RealtimeProvider;
  openaiApiKey?: string;
  defaultSessionConfig?: RealtimeSessionConfig;
}

@Service()
export class RealtimeService {
  private readonly options: RealtimeServiceOptions;
  private sessions = new Map<string, OpenAIRealtimeSession>();

  constructor(options: RealtimeServiceOptions = {}) {
    this.options = {
      defaultProvider: options.defaultProvider ?? 'openai',
      openaiApiKey: options.openaiApiKey ?? process.env.OPENAI_API_KEY,
      defaultSessionConfig: options.defaultSessionConfig,
      ...options,
    };
  }

  /**
   * Create and connect an OpenAI Realtime session for a client
   */
  async createOpenAISession(
    client: RealtimeClientAdapter,
    overrides?: { model?: string; sessionConfig?: RealtimeSessionConfig }
  ): Promise<OpenAIRealtimeSession> {
    const apiKey = this.options.openaiApiKey;
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required for OpenAI Realtime. Set env or openaiApiKey in RealtimeModule.'
      );
    }

    const session = new OpenAIRealtimeSession(client, {
      apiKey,
      model: overrides?.model,
      sessionConfig: overrides?.sessionConfig ?? this.options.defaultSessionConfig,
    });

    await session.connect();
    this.sessions.set(client.id, session);
    return session;
  }

  /**
   * Get session by client ID
   */
  getSession(clientId: string): OpenAIRealtimeSession | undefined {
    return this.sessions.get(clientId);
  }

  /**
   * Remove and disconnect session
   */
  removeSession(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (session) {
      session.disconnect();
      this.sessions.delete(clientId);
    }
  }

  /**
   * Get all active session stats
   */
  getStats(): Array<{ clientId: string } & ReturnType<OpenAIRealtimeSession['getStats']>> {
    return Array.from(this.sessions.entries()).map(([clientId, session]) => ({
      clientId,
      ...session.getStats(),
    }));
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
