import { IncomingMessage } from 'http';

/**
 * WebSocket client interface
 */
export interface WebSocketClient {
  /**
   * Unique client ID
   */
  id: string;

  /**
   * Client socket
   */
  socket: unknown;

  /**
   * Client metadata
   */
  metadata: Map<string, unknown>;

  /**
   * Rooms the client is in
   */
  rooms: Set<string>;

  /**
   * Send message to client
   */
  send(event: string, data: unknown): void;

  /**
   * Disconnect client
   */
  disconnect(): void;

  /**
   * Join a room
   */
  join(room: string): void;

  /**
   * Leave a room
   */
  leave(room: string): void;

  /**
   * Check if client is in a room
   */
  inRoom(room: string): boolean;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  /**
   * Event name
   */
  event: string;

  /**
   * Message data
   */
  data: unknown;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Client ID
   */
  clientId?: string;
}

/**
 * WebSocket gateway options
 */
export interface WebSocketGatewayOptions {
  /**
   * Gateway path
   */
  path?: string;

  /**
   * Namespace
   */
  namespace?: string;

  /**
   * CORS options
   */
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };

  /**
   * Authentication required
   */
  auth?: boolean;

  /**
   * Ping interval in milliseconds
   */
  pingInterval?: number;

  /**
   * Ping timeout in milliseconds
   */
  pingTimeout?: number;

  /**
   * Maximum payload size in bytes
   */
  maxPayload?: number;
}

/**
 * Room interface
 */
export interface Room {
  /**
   * Room name
   */
  name: string;

  /**
   * Clients in the room
   */
  clients: Set<string>;

  /**
   * Room metadata
   */
  metadata: Map<string, unknown>;

  /**
   * Created timestamp
   */
  createdAt: number;
}

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (
  client: WebSocketClient,
  data: unknown
) => void | Promise<void>;

/**
 * Connection handler
 */
export type ConnectionHandler = (
  client: WebSocketClient,
  request: IncomingMessage
) => void | Promise<void>;

/**
 * Disconnection handler
 */
export type DisconnectionHandler = (
  client: WebSocketClient,
  reason?: string
) => void | Promise<void>;

/**
 * WebSocket server options
 */
export interface WebSocketServerOptions {
  /**
   * Port to listen on
   */
  port?: number;

  /**
   * Host to bind to
   */
  host?: string;

  /**
   * Path for WebSocket endpoint
   */
  path?: string;

  /**
   * Enable per-message deflate
   */
  perMessageDeflate?: boolean;

  /**
   * Maximum payload size
   */
  maxPayload?: number;

  /**
   * Client tracking
   */
  clientTracking?: boolean;
}

/**
 * SSE (Server-Sent Events) options
 */
export interface SSEOptions {
  /**
   * Retry interval in milliseconds
   */
  retry?: number;

  /**
   * Keep-alive interval in milliseconds
   */
  keepAlive?: number;

  /**
   * Event ID
   */
  id?: string;
}

/**
 * SSE message
 */
export interface SSEMessage {
  /**
   * Event type
   */
  event?: string;

  /**
   * Message data
   */
  data: unknown;

  /**
   * Event ID
   */
  id?: string;

  /**
   * Retry interval
   */
  retry?: number;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /**
   * Topic pattern
   */
  topic: string;

  /**
   * Filter function
   */
  filter?: (data: unknown) => boolean;

  /**
   * Transform function
   */
  transform?: (data: unknown) => unknown;

  /**
   * Batch size
   */
  batchSize?: number;

  /**
   * Batch interval in milliseconds
   */
  batchInterval?: number;
}

/**
 * WebSocket statistics
 */
export interface WebSocketStats {
  /**
   * Total connected clients
   */
  connectedClients: number;

  /**
   * Total rooms
   */
  totalRooms: number;

  /**
   * Messages sent
   */
  messagesSent: number;

  /**
   * Messages received
   */
  messagesReceived: number;

  /**
   * Bytes sent
   */
  bytesSent: number;

  /**
   * Bytes received
   */
  bytesReceived: number;

  /**
   * Uptime in milliseconds
   */
  uptime: number;
}
