/**
 * Event bus for cross-module event emission and subscription
 */

import type { HazelEvent } from '@hazeljs/contracts';

/** Event handler callback */
export type EventHandler = (event: HazelEvent) => void | Promise<void>;

/** Event bus interface - integrate via shared bus, not hard imports */
export interface EventBus {
  /** Publish event to all subscribers */
  publish(event: HazelEvent): void | Promise<void>;
  /** Subscribe to events */
  subscribe(handler: EventHandler): () => void;
}
