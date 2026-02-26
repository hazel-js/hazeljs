import { Injectable } from '@hazeljs/core';
import EventEmitter2 from 'eventemitter2';
import type { EventEmitterModuleOptions } from './event-emitter.types';

/**
 * Event emitter service - wraps EventEmitter2 for DI injection
 * Use this service to emit events throughout your application
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderService {
 *   constructor(private eventEmitter: EventEmitterService) {}
 *
 *   createOrder(order: Order) {
 *     // ... create order
 *     this.eventEmitter.emit('order.created', new OrderCreatedEvent(order));
 *   }
 * }
 * ```
 */
@Injectable()
export class EventEmitterService extends EventEmitter2 {
  constructor(options?: EventEmitterModuleOptions) {
    super(options ?? {});
  }

  /**
   * Emit an event
   * @param event - Event name
   * @param values - Payload values (spread as arguments to listeners)
   */
  override emit(event: string | symbol, ...values: unknown[]): boolean {
    return super.emit(event, ...values);
  }

  /**
   * Emit an event asynchronously (listeners receive a promise)
   */
  override emitAsync(event: string | symbol, ...values: unknown[]): Promise<unknown[]> {
    return super.emitAsync(event, ...values);
  }
}
