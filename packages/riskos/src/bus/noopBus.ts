/**
 * No-op event bus for when no bus is configured
 */

import type { EventBus, EventHandler } from './eventBus';
import type { HazelEvent } from '@hazeljs/contracts';

/** Event bus that does nothing - used when no integration is configured */
export class NoopBus implements EventBus {
  publish(_event: HazelEvent): void {
    // no-op
  }

  subscribe(_handler: EventHandler): () => void {
    return () => {
      // no-op unsubscribe
    };
  }
}
