import 'reflect-metadata';
import { OnEventOptions } from './event-emitter.types';

/**
 * Metadata key for event listeners
 */
export const ON_EVENT_METADATA_KEY = Symbol('event-emitter:on-event');

export interface OnEventMetadata {
  event: string | symbol | string[];
  methodName: string;
  options?: OnEventOptions;
}

/**
 * Decorator to mark a method as an event listener
 * @param event - Event name(s) to listen for. With wildcards enabled, supports patterns like 'order.*'
 * @param options - Listener options
 *
 * @example
 * ```typescript
 * @OnEvent('order.created')
 * handleOrderCreated(payload: OrderCreatedEvent) {
 *   // handle event
 * }
 *
 * // With wildcards (when EventEmitterModule.forRoot({ wildcard: true }))
 * @OnEvent('order.*')
 * handleOrderEvents(payload: OrderCreatedEvent | OrderUpdatedEvent) {
 *   // handle any order event
 * }
 * ```
 */
export function OnEvent(
  event: string | symbol | string[],
  options?: OnEventOptions
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing: OnEventMetadata[] =
      Reflect.getMetadata(ON_EVENT_METADATA_KEY, target.constructor) || [];

    existing.push({
      event,
      methodName: propertyKey.toString(),
      options: {
        suppressErrors: true,
        ...options,
      },
    });

    Reflect.defineMetadata(ON_EVENT_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Get @OnEvent metadata from a class
 */
export function getOnEventMetadata(target: object): OnEventMetadata[] {
  return Reflect.getMetadata(ON_EVENT_METADATA_KEY, target.constructor) || [];
}
