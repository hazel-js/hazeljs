/**
 * RealtimeGateway - WebSocket server for real-time voice AI
 * Uses @Realtime decorator, extends WebSocketGateway, proxies to OpenAI Realtime API
 */

import 'reflect-metadata';
import { Server as HttpServer } from 'http';
import type { WebSocketServer } from 'ws';
import { WebSocketGateway, Realtime, getRealtimeMetadata } from '@hazeljs/websocket';
import type { WebSocketClient, WebSocketMessage } from '@hazeljs/websocket';
import logger from '@hazeljs/core';
import { RealtimeService } from './realtime.service';
import type { OpenAIRealtimeSession } from './providers/openai';

export interface RealtimeGatewayOptions {
  /** WebSocket path (default: /realtime) */
  path?: string;
  /** Max payload size in bytes (default: 1MB) */
  maxPayload?: number;
}

/**
 * Gateway for real-time voice AI — uses @Realtime decorator for path/config
 */
@Realtime({ path: '/realtime', maxPayload: 1048576 })
export class RealtimeGateway extends WebSocketGateway {
  private readonly realtimeService: RealtimeService;
  private readonly realtimeOptions: RealtimeGatewayOptions;
  private sessionPromises = new Map<string, Promise<OpenAIRealtimeSession>>();

  constructor(realtimeService: RealtimeService, options: RealtimeGatewayOptions = {}) {
    super();
    this.realtimeService = realtimeService;
    const metadata = getRealtimeMetadata(RealtimeGateway);
    this.realtimeOptions = {
      path: options.path ?? metadata?.path ?? '/realtime',
      maxPayload: options.maxPayload ?? metadata?.maxPayload ?? 1048576,
    };
  }

  /**
   * Attach Realtime WebSocket server to existing HTTP server
   */
  override attachToServer(
    server: HttpServer,
    options?: { path?: string; maxPayload?: number }
  ): WebSocketServer {
    return super.attachToServer(server, {
      path: options?.path ?? this.realtimeOptions.path,
      maxPayload: options?.maxPayload ?? this.realtimeOptions.maxPayload,
      perMessageDeflate: false,
    });
  }

  /**
   * Override: create OpenAI session on connection (async, stored for handleMessage)
   */
  protected override handleConnection(client: WebSocketClient): void {
    const clientId = client.id;
    const sessionPromise = this.realtimeService.createOpenAISession(client);
    this.sessionPromises.set(clientId, sessionPromise);

    sessionPromise
      .then(() => logger.info(`Realtime session started: ${clientId}`))
      .catch((err) => {
        logger.error(`Realtime session failed for ${clientId}:`, err);
        client.disconnect();
      });

    super.handleConnection(client);
  }

  /**
   * Override: forward messages to OpenAI session (await session if still connecting)
   */
  protected override handleMessage(clientId: string, message: WebSocketMessage): void {
    const sessionPromise = this.sessionPromises.get(clientId);
    if (!sessionPromise) return;

    sessionPromise
      .then((session) => {
        // Realtime client sends raw OpenAI events (e.g. { type, audio })
        session.handleClientMessage(message);
      })
      .catch(() => {
        // Session failed, ignore message
      });
  }

  /**
   * Override: cleanup session on disconnect
   */
  protected override handleDisconnection(clientId: string): void {
    this.sessionPromises.delete(clientId);
    this.realtimeService.removeSession(clientId);
    logger.info(`Realtime session ended: ${clientId}`);
    super.handleDisconnection(clientId);
  }
}
