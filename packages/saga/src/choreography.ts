import 'reflect-metadata';
import { EventEmitterService } from '@hazeljs/event-emitter';

export class SagaChoreographyManager {
  private static instance: SagaChoreographyManager;
  private readonly eventEmitter: EventEmitterService;

  private constructor() {
    this.eventEmitter = new EventEmitterService({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    });
  }

  static getInstance(): SagaChoreographyManager {
    if (!SagaChoreographyManager.instance) {
      SagaChoreographyManager.instance = new SagaChoreographyManager();
    }
    return SagaChoreographyManager.instance;
  }

  subscribe(eventName: string, handler: (event: unknown) => Promise<void>): void {
    this.eventEmitter.on(eventName, handler);
  }
}

/**
 * Decorator to mark a class as a Saga Choreography handler.
 */
export function SagaChoreography() {
  return function (constructor: new (...args: unknown[]) => unknown): void {
    // Collect OnEvent metadata and register with the manager
    const handlers: { eventName: string; methodName: string }[] =
      Reflect.getMetadata('hazeljs:saga:choreography:handlers', constructor.prototype) || [];

    const manager = SagaChoreographyManager.getInstance();
    const instance = (
      constructor as unknown as { prototype: Record<string, (d: unknown) => Promise<void>> }
    ).prototype;

    for (const handler of handlers) {
      manager.subscribe(handler.eventName, async (data: unknown) => {
        // We need an instance to call the method on.
        // For this simple implementation, we'll assume a singleton or create one.
        // In a real HazelJS app, this would be handled by the DI container.
        await instance[handler.methodName](data);
      });
    }
  };
}

/**
 * Decorator to mark a method as an event handler in a choreography.
 */
export function OnEvent(eventName: string) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor): void {
    const handlers =
      (Reflect.getMetadata('hazeljs:saga:choreography:handlers', target) as {
        eventName: string;
        methodName: string;
      }[]) || [];
    handlers.push({ eventName, methodName: propertyKey });
    Reflect.defineMetadata('hazeljs:saga:choreography:handlers', handlers, target);
  };
}
