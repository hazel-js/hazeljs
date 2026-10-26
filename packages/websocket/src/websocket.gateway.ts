import {
  WebSocketClient,
  WebSocketMessage,
  WebSocketStats,
  WebSocketServerOptions,
} from './websocket.types';
import { RoomManager } from './room/room.manager';
import { dispatchOnConnect, dispatchOnDisconnect, dispatchOnMessage } from './decorator-dispatch';
import { getRealtimeMetadata, isRealtimeGateway } from './decorators/realtime.decorator';
import logger, { type HazelApp } from '@hazeljs/core';
import { Server as HttpServer, IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

/**
 * Base WebSocket Gateway class.
 *
 * Gateways marked with `@Realtime(...)` auto-attach on application bootstrap
 * using that metadata — apps only declare decorators and handlers.
 */
export class WebSocketGateway {
  protected clients: Map<string, WebSocketClient> = new Map();
  protected roomManager: RoomManager = new RoomManager();
  protected wss: WebSocketServer | null = null;
  protected path = '/ws';
  protected stats: WebSocketStats = {
    connectedClients: 0,
    totalRooms: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    uptime: Date.now(),
  };

  /**
   * Merge call-site options with `@Realtime` metadata on the concrete class.
   * Explicit `options` always win.
   */
  protected resolveServerOptions(options: WebSocketServerOptions = {}): WebSocketServerOptions {
    const meta = getRealtimeMetadata(this.constructor as new (...args: unknown[]) => object);
    return {
      path: meta?.path ?? '/ws',
      maxPayload: meta?.maxPayload ?? 1048576,
      perMessageDeflate: false,
      clientTracking: true,
      ...options,
    };
  }

  /**
   * Resolved WebSocket path (from `@Realtime` / last attach).
   */
  getPath(): string {
    return this.path;
  }

  /**
   * Auto-attach when this class is marked `@Realtime` and the HTTP server is ready.
   * Skip if already attached (e.g. manual `attachToServer` during tests).
   */
  onApplicationBootstrap(app: HazelApp): void {
    if (this.wss) return;
    if (!isRealtimeGateway(this.constructor as new (...args: unknown[]) => object)) {
      return;
    }
    const server = app.getServer();
    if (server) {
      this.attachToServer(server);
    }
  }

  /**
   * Attach WebSocket server to an existing HTTP server.
   * Options default from `@Realtime` on the subclass when present.
   */
  attachToServer(server: HttpServer, options: WebSocketServerOptions = {}): WebSocketServer {
    const resolved = this.resolveServerOptions(options);
    this.path = resolved.path || '/ws';
    this.wss = new WebSocketServer({
      server,
      path: this.path,
      perMessageDeflate: resolved.perMessageDeflate ?? false,
      maxPayload: resolved.maxPayload || 1048576,
      clientTracking: resolved.clientTracking ?? true,
    });

    this.wss.on('connection', (socket: WebSocket, _request: IncomingMessage) => {
      const clientId = randomUUID();
      const client = createWebSocketClient(socket, clientId);

      this.handleConnection(client);

      socket.on('message', (data: WebSocket.RawData) => {
        try {
          const parsed = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientId, parsed);
        } catch {
          logger.warn(`Invalid WebSocket message from ${clientId}`);
        }
      });

      socket.on('close', () => {
        this.handleDisconnection(clientId);
      });

      socket.on('error', (error: Error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket server error:', error);
    });

    logger.info(`WebSocket server attached at path: ${this.path}`);
    return this.wss;
  }

  /**
   * Create a standalone WebSocket server (without HTTP server)
   */
  listen(port: number, options: WebSocketServerOptions = {}): WebSocketServer {
    const resolved = this.resolveServerOptions(options);
    this.path = resolved.path || '/ws';
    this.wss = new WebSocketServer({
      port,
      path: this.path,
      perMessageDeflate: resolved.perMessageDeflate ?? false,
      maxPayload: resolved.maxPayload || 1048576,
      clientTracking: resolved.clientTracking ?? true,
    });

    this.wss.on('connection', (socket: WebSocket, _request: IncomingMessage) => {
      const clientId = randomUUID();
      const client = createWebSocketClient(socket, clientId);

      this.handleConnection(client);

      socket.on('message', (data: WebSocket.RawData) => {
        try {
          const parsed = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientId, parsed);
        } catch {
          logger.warn(`Invalid WebSocket message from ${clientId}`);
        }
      });

      socket.on('close', () => {
        this.handleDisconnection(clientId);
      });

      socket.on('error', (error: Error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });
    });

    logger.info(`WebSocket server listening on port ${port}`);
    return this.wss;
  }

  /**
   * Close the WebSocket server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.disconnectAll();
      this.wss.close((err) => {
        if (err) reject(err);
        else {
          this.wss = null;
          logger.info('WebSocket server closed');
          resolve();
        }
      });
    });
  }

  /**
   * Handle client connection — registers the client, then invokes @OnConnect handlers.
   * Override and call `super.handleConnection(client)` to keep decorator dispatch.
   */
  protected handleConnection(client: WebSocketClient): void {
    this.clients.set(client.id, client);
    this.stats.connectedClients = this.clients.size;
    logger.info(`WebSocket client connected: ${client.id}`);
    dispatchOnConnect(this, client);
  }

  /**
   * Handle client disconnection — invokes @OnDisconnect first (while client is still
   * available), then cleans up rooms. Override and call `super.handleDisconnection`
   * to keep decorator dispatch.
   */
  protected handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      dispatchOnDisconnect(this, client);
      this.roomManager.removeClientFromAllRooms(clientId);
      this.clients.delete(clientId);
      this.stats.connectedClients = this.clients.size;
      logger.info(`WebSocket client disconnected: ${clientId}`);
    }
  }

  /**
   * Handle incoming message — updates stats, then invokes @OnMessage / @Subscribe handlers.
   * Override and call `super.handleMessage(clientId, message)` to keep decorator dispatch.
   */
  protected handleMessage(clientId: string, message: WebSocketMessage): void {
    this.stats.messagesReceived++;
    this.stats.bytesReceived += JSON.stringify(message).length;
    logger.debug(`Message received from ${clientId}: ${message.event}`);
    const client = this.clients.get(clientId);
    if (client) {
      dispatchOnMessage(this, client, message);
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, event: string, data: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.send(event, data);
    this.stats.messagesSent++;
    this.stats.bytesSent += JSON.stringify(data).length;
    return true;
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(event: string, data: unknown, excludeClientId?: string): void {
    for (const [clientId, client] of this.clients) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }
      client.send(event, data);
    }

    this.stats.messagesSent += this.clients.size;
    this.stats.bytesSent += JSON.stringify(data).length * this.clients.size;
    logger.debug(`Broadcast: ${event} to ${this.clients.size} clients`);
  }

  /**
   * Broadcast to a specific room
   */
  broadcastToRoom(roomName: string, event: string, data: unknown, excludeClientId?: string): void {
    this.roomManager.broadcastToRoom(roomName, event, data, this.clients, excludeClientId);
    this.stats.messagesSent++;
  }

  /**
   * Add client to a room. Optionally bind connection-scoped data in the same call.
   */
  joinRoom(
    clientOrId: string | WebSocketClient,
    roomName: string,
    data?: Record<string, unknown>
  ): void {
    const clientId = typeof clientOrId === 'string' ? clientOrId : clientOrId.id;
    const client = typeof clientOrId === 'string' ? this.clients.get(clientOrId) : clientOrId;
    if (!client) return;
    client.join(roomName);
    this.roomManager.addClientToRoom(clientId, roomName);
    this.stats.totalRooms = this.roomManager.getRoomCount();
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) client.set(key, value);
      }
    }
  }

  /**
   * Remove client from a room
   */
  leaveRoom(clientOrId: string | WebSocketClient, roomName: string): void {
    const clientId = typeof clientOrId === 'string' ? clientOrId : clientOrId.id;
    const client = typeof clientOrId === 'string' ? this.clients.get(clientOrId) : clientOrId;
    if (!client) return;
    client.leave(roomName);
    this.roomManager.removeClientFromRoom(clientId, roomName);
    this.stats.totalRooms = this.roomManager.getRoomCount();
  }

  /**
   * Get all clients
   */
  getClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get room clients
   */
  getRoomClients(roomName: string): string[] {
    return this.roomManager.getRoomClients(roomName);
  }

  /**
   * Get client rooms
   */
  getClientRooms(clientId: string): string[] {
    return this.roomManager.getClientRooms(clientId);
  }

  /**
   * Get statistics
   */
  getStats(): WebSocketStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
      totalRooms: this.roomManager.getRoomCount(),
    };
  }

  /**
   * Disconnect a client
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.disconnect();
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
    this.roomManager.clear();
    this.stats.connectedClients = 0;
    this.stats.totalRooms = 0;
    logger.info('All WebSocket clients disconnected');
  }
}

/**
 * Create a WebSocket client wrapper
 */
export function createWebSocketClient(socket: unknown, id: string): WebSocketClient {
  const metadata = new Map<string, unknown>();
  const client: WebSocketClient = {
    id,
    socket,
    metadata,
    rooms: new Set(),

    send(event: string, data: unknown) {
      try {
        const message = JSON.stringify({ event, data, timestamp: Date.now() });
        (socket as { send: (message: string) => void }).send(message);
      } catch (error) {
        logger.error(`Failed to send message to client ${id}:`, error);
      }
    },

    get<T = unknown>(key: string): T | undefined {
      return metadata.get(key) as T | undefined;
    },

    set(key: string, value: unknown) {
      metadata.set(key, value);
    },

    disconnect() {
      try {
        (socket as { close: () => void }).close();
      } catch (error) {
        logger.error(`Failed to disconnect client ${id}:`, error);
      }
    },

    join(room: string) {
      this.rooms.add(room);
    },

    leave(room: string) {
      this.rooms.delete(room);
    },

    inRoom(room: string): boolean {
      return this.rooms.has(room);
    },
  };

  return client;
}
