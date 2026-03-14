/**
 * OpenAI Realtime Session - manages a single voice session with proxying to client
 */

/**
 * Minimal client interface for realtime session (avoids @hazeljs/websocket peer dep)
 */
export interface RealtimeClientAdapter {
  id: string;
  send(event: string, data: unknown): void;
}
import { OpenAIRealtimeClient } from './openai-realtime.client';
import type { RealtimeSessionConfig, RealtimeServerEvent } from '../../realtime.types';

export interface OpenAIRealtimeSessionOptions {
  apiKey: string;
  model?: string;
  sessionConfig?: RealtimeSessionConfig;
}

/**
 * A realtime session that proxies between a WebSocket client and OpenAI Realtime API
 */
export class OpenAIRealtimeSession {
  private readonly client: OpenAIRealtimeClient;
  private readonly hazelClient: RealtimeClientAdapter;
  private stats = {
    audioChunksReceived: 0,
    audioChunksSent: 0,
    eventsReceived: 0,
    eventsSent: 0,
  };

  constructor(hazelClient: RealtimeClientAdapter, options: OpenAIRealtimeSessionOptions) {
    this.hazelClient = hazelClient;
    this.client = new OpenAIRealtimeClient({
      apiKey: options.apiKey,
      model: options.model,
      sessionConfig: options.sessionConfig,
    });

    // Forward all OpenAI server events to HazelJS client
    this.client.onAny((event: RealtimeServerEvent) => {
      this.stats.eventsReceived++;
      this.forwardToClient(event);
    });
  }

  /**
   * Connect to OpenAI and start session
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Forward OpenAI server event to HazelJS client
   */
  private forwardToClient(event: RealtimeServerEvent): void {
    this.hazelClient.send('realtime', event);
  }

  /**
   * Handle message from HazelJS client - forward to OpenAI
   */
  handleClientMessage(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) return;

    const obj = payload as Record<string, unknown>;

    // Client can send raw OpenAI client events
    if (obj.type && typeof obj.type === 'string') {
      this.client.send(obj as Parameters<OpenAIRealtimeClient['send']>[0]);
      this.stats.eventsSent++;

      // Special handling for base64 audio
      if (obj.type === 'input_audio_buffer.append' && typeof obj.audio === 'string') {
        this.stats.audioChunksSent++;
      }
    }
  }

  /**
   * Append audio from client
   */
  appendAudio(base64Audio: string): void {
    this.client.appendAudio(base64Audio);
    this.stats.audioChunksSent++;
  }

  /**
   * Send text message
   */
  sendText(text: string): void {
    this.client.addConversationItem(text);
    this.client.createResponse({ outputModalities: ['audio', 'text'] });
  }

  /**
   * Get session stats
   */
  getStats(): {
    sessionId: string;
    provider: 'openai';
    connectedAt: number;
    audioChunksReceived: number;
    audioChunksSent: number;
    eventsReceived: number;
    eventsSent: number;
  } {
    return {
      sessionId: this.hazelClient.id,
      provider: 'openai' as const,
      connectedAt: Date.now(),
      ...this.stats,
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.client.disconnect();
  }

  get isConnected(): boolean {
    return this.client.connected;
  }
}
