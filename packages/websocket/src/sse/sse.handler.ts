import { IncomingMessage, ServerResponse } from 'http';
import { SSEMessage, SSEOptions } from '../websocket.types';
import logger from '@hazeljs/core';

/**
 * Server-Sent Events (SSE) handler
 */
export class SSEHandler {
  private connections: Map<string, ServerResponse> = new Map();
  private keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize SSE connection
   */
  initConnection(req: IncomingMessage, res: ServerResponse, options: SSEOptions = {}): string {
    const connectionId = this.generateConnectionId();

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial retry interval
    if (options.retry) {
      res.write(`retry: ${options.retry}\n\n`);
    }

    // Store connection
    this.connections.set(connectionId, res);

    // Setup keep-alive
    const keepAliveInterval = options.keepAlive || 30000;
    const interval = setInterval(() => {
      if (this.connections.has(connectionId)) {
        res.write(': keep-alive\n\n');
      } else {
        clearInterval(interval);
      }
    }, keepAliveInterval);

    this.keepAliveIntervals.set(connectionId, interval);

    // Handle connection close
    req.on('close', () => {
      this.closeConnection(connectionId);
    });

    logger.debug(`SSE connection initialized: ${connectionId}`);

    return connectionId;
  }

  /**
   * Send message to a specific connection
   */
  send(connectionId: string, message: SSEMessage): boolean {
    const res = this.connections.get(connectionId);
    if (!res) {
      return false;
    }

    try {
      let output = '';

      // Add event type
      if (message.event) {
        output += `event: ${message.event}\n`;
      }

      // Add ID
      if (message.id) {
        output += `id: ${message.id}\n`;
      }

      // Add retry
      if (message.retry) {
        output += `retry: ${message.retry}\n`;
      }

      // Add data (can be multi-line)
      const data = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);

      const lines = data.split('\n');
      for (const line of lines) {
        output += `data: ${line}\n`;
      }

      output += '\n';

      res.write(output);
      return true;
    } catch (error) {
      logger.error(`Failed to send SSE message to ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: SSEMessage): void {
    for (const connectionId of this.connections.keys()) {
      this.send(connectionId, message);
    }

    logger.debug(`SSE broadcast: ${message.event || 'message'}`);
  }

  /**
   * Close a specific connection
   */
  closeConnection(connectionId: string): void {
    const res = this.connections.get(connectionId);
    if (res) {
      res.end();
      this.connections.delete(connectionId);
    }

    const interval = this.keepAliveIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.keepAliveIntervals.delete(connectionId);
    }

    logger.debug(`SSE connection closed: ${connectionId}`);
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }

    logger.info('All SSE connections closed');
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if connection exists
   */
  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Get all connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a stream for continuous data
   */
  async *createStream<T>(
    connectionId: string,
    dataSource: AsyncIterable<T> | Iterable<T>,
    options: { event?: string; transform?: (data: T) => unknown } = {}
  ): AsyncGenerator<boolean> {
    try {
      for await (const data of dataSource) {
        const transformedData = options.transform ? options.transform(data) : data;
        const sent = this.send(connectionId, {
          event: options.event,
          data: transformedData,
        });

        yield sent;

        if (!sent) {
          break;
        }
      }
    } catch (error) {
      logger.error(`SSE stream error for ${connectionId}:`, error);
    }
  }
}

/**
 * Helper function to create SSE response
 */
export function createSSEResponse(res: ServerResponse, options: SSEOptions = {}): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  if (options.retry) {
    res.write(`retry: ${options.retry}\n\n`);
  }
}

/**
 * Helper function to send SSE message
 */
export function sendSSEMessage(res: ServerResponse, message: SSEMessage): void {
  let output = '';

  if (message.event) {
    output += `event: ${message.event}\n`;
  }

  if (message.id) {
    output += `id: ${message.id}\n`;
  }

  if (message.retry) {
    output += `retry: ${message.retry}\n`;
  }

  const data = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);

  const lines = data.split('\n');
  for (const line of lines) {
    output += `data: ${line}\n`;
  }

  output += '\n';

  res.write(output);
}
