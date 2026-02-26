/**
 * In-memory event bus implementation
 */

import type { EventBus, EventHandler } from './eventBus';
import type { HazelEvent } from '@hazeljs/contracts';

export class MemoryEventBus implements EventBus {
  private handlers: EventHandler[] = [];

  publish(event: HazelEvent): void {
    for (const h of this.handlers) {
      try {
        h(event);
      } catch {
        // swallow handler errors
      }
    }
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}
