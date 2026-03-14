/**
 * OpenAI Realtime API WebSocket client
 * Connects to wss://api.openai.com/v1/realtime and handles bidirectional event flow
 */

import logger from '@hazeljs/core';
import WebSocket from 'ws';
import type {
  RealtimeClientEvent,
  RealtimeServerEvent,
  RealtimeSessionConfig,
} from '../../realtime.types';

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

export interface OpenAIRealtimeClientOptions {
  apiKey: string;
  model?: string;
  sessionConfig?: RealtimeSessionConfig;
}

export type RealtimeEventHandler = (event: RealtimeServerEvent) => void | Promise<void>;

/**
 * Low-level OpenAI Realtime API WebSocket client
 */
export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly sessionConfig?: RealtimeSessionConfig;
  private eventHandlers: Map<string, Set<RealtimeEventHandler>> = new Map();
  private genericHandlers: Set<RealtimeEventHandler> = new Set();
  private _connected = false;

  constructor(options: OpenAIRealtimeClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-realtime';
    this.sessionConfig = options.sessionConfig;
  }

  get connected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(this.model)}`;
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        this._connected = true;
        this.sendSessionUpdate();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const event = JSON.parse(data.toString()) as RealtimeServerEvent;
          this.handleServerEvent(event);
        } catch (err) {
          this.emit('error', { type: 'error', error: String(err) } as RealtimeServerEvent);
        }
      });

      this.ws.on('close', (code, reason) => {
        this._connected = false;
        this.emit('session.ended', {
          type: 'session.ended',
          code,
          reason: reason.toString(),
        } as RealtimeServerEvent);
      });

      this.ws.on('error', (err) => {
        this._connected = false;
        this.emit('error', { type: 'error', error: err.message } as RealtimeServerEvent);
        reject(err);
      });
    });
  }

  /**
   * Send session.update with config
   */
  private sendSessionUpdate(): void {
    if (!this.sessionConfig) return;

    const session: Record<string, unknown> = {
      type: 'realtime',
      model: this.model,
      output_modalities: this.sessionConfig.outputModalities ?? ['audio', 'text'],
      instructions: this.sessionConfig.instructions ?? 'You are a helpful assistant.',
    };

    if (this.sessionConfig.voice) {
      session.audio = {
        ...(session.audio as object),
        output: {
          format: this.sessionConfig.outputFormat ?? { type: 'audio/pcm' },
          voice: this.sessionConfig.voice,
        },
      };
    }

    if (this.sessionConfig.inputFormat) {
      session.audio = {
        ...(session.audio as object),
        input: {
          format: this.sessionConfig.inputFormat,
          turn_detection:
            this.sessionConfig.turnDetection !== false ? { type: 'server_vad' } : undefined,
        },
      };
    }

    this.send({ type: 'session.update', session });
  }

  /**
   * Send a client event to OpenAI
   */
  send(event: RealtimeClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(event));
  }

  /**
   * Append audio to input buffer (base64 PCM)
   */
  appendAudio(base64Audio: string): void {
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  /**
   * Commit input buffer (when VAD disabled)
   */
  commitInputBuffer(): void {
    this.send({ type: 'input_audio_buffer.commit' });
  }

  /**
   * Clear input buffer
   */
  clearInputBuffer(): void {
    this.send({ type: 'input_audio_buffer.clear' });
  }

  /**
   * Create a response (trigger model to respond)
   */
  createResponse(options?: { outputModalities?: ('audio' | 'text')[] }): void {
    this.send({
      type: 'response.create',
      response: options ?? {},
    });
  }

  /**
   * Add text to conversation
   */
  addConversationItem(text: string): void {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
  }

  /**
   * Subscribe to server events
   */
  on(eventType: string, handler: RealtimeEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: RealtimeEventHandler): () => void {
    this.genericHandlers.add(handler);
    return () => this.genericHandlers.delete(handler);
  }

  private handleServerEvent(event: RealtimeServerEvent): void {
    const typeHandlers = this.eventHandlers.get(event.type);
    if (typeHandlers) {
      for (const h of typeHandlers) {
        try {
          h(event);
        } catch (err) {
          logger.error(`Realtime event handler error (${event.type}):`, err);
        }
      }
    }
    for (const h of this.genericHandlers) {
      try {
        h(event);
      } catch (err) {
        logger.error('Realtime generic handler error:', err);
      }
    }
  }

  private emit(eventType: string, event: RealtimeServerEvent): void {
    this.handleServerEvent(event);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.eventHandlers.clear();
    this.genericHandlers.clear();
  }
}
