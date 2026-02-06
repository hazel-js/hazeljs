/**
 * Agent Event Emitter
 * Handles event emission and subscription for agent runtime
 */

import { AgentEvent, AgentEventType } from '../types/event.types';
import { Logger, LogLevel } from '../utils/logger';

type EventHandler<T = unknown> = (event: AgentEvent<T>) => void | Promise<void>;

/**
 * Agent Event Emitter
 * Pub/sub system for agent runtime events
 */
export class AgentEventEmitter {
  private handlers: Map<AgentEventType, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();
  private logger = new Logger({ level: LogLevel.WARN });

  /**
   * Subscribe to an event type
   */
  on<T = unknown>(type: AgentEventType, handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler): void {
    this.wildcardHandlers.add(handler);
  }

  /**
   * Unsubscribe from an event type
   */
  off(type: AgentEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Unsubscribe from all events
   */
  offAny(handler: EventHandler): void {
    this.wildcardHandlers.delete(handler);
  }

  /**
   * Emit an event
   */
  async emit<T = unknown>(
    type: AgentEventType,
    agentId: string,
    executionId: string,
    data: T,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: AgentEvent<T> = {
      type,
      agentId,
      executionId,
      timestamp: new Date(),
      data,
      metadata,
    };

    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          this.logger.error(
            `Error in event handler for ${type}`,
            error instanceof Error ? error : new Error(String(error)),
            { executionId }
          );
        }
      }
    }

    for (const handler of this.wildcardHandlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Error in wildcard event handler for ${type}`,
          error instanceof Error ? error : new Error(String(error)),
          { executionId }
        );
      }
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  /**
   * Get handler count for an event type
   */
  listenerCount(type: AgentEventType): number {
    return this.handlers.get(type)?.size || 0;
  }
}
