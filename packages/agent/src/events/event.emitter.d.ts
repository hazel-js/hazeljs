/**
 * Agent Event Emitter
 * Handles event emission and subscription for agent runtime
 */
import { AgentEvent, AgentEventType } from '../types/event.types';
type EventHandler<T = unknown> = (event: AgentEvent<T>) => void | Promise<void>;
/**
 * Agent Event Emitter
 * Pub/sub system for agent runtime events
 */
export declare class AgentEventEmitter {
  private handlers;
  private wildcardHandlers;
  private logger;
  /**
   * Subscribe to an event type
   */
  on<T = unknown>(type: AgentEventType, handler: EventHandler<T>): void;
  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler): void;
  /**
   * Unsubscribe from an event type
   */
  off(type: AgentEventType, handler: EventHandler): void;
  /**
   * Unsubscribe from all events
   */
  offAny(handler: EventHandler): void;
  /**
   * Emit an event
   */
  emit<T = unknown>(
    type: AgentEventType,
    agentId: string,
    executionId: string,
    data: T,
    metadata?: Record<string, unknown>
  ): Promise<void>;
  /**
   * Clear all handlers
   */
  clear(): void;
  /**
   * Get handler count for an event type
   */
  listenerCount(type: AgentEventType): number;
}
export {};
//# sourceMappingURL=event.emitter.d.ts.map
