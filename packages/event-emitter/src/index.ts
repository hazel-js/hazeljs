/**
 * @hazeljs/event-emitter - Event emitter module for HazelJS
 *
 * Event-driven architecture with decorators, similar to @nestjs/event-emitter.
 * Built on eventemitter2 - supports wildcards, namespaces, and async listeners.
 */

export { EventEmitterModule, type EventEmitterModuleConfig } from './event-emitter.module';
export { EventEmitterService } from './event-emitter.service';
export { OnEvent, getOnEventMetadata } from './on-event.decorator';
export type { OnEventMetadata } from './on-event.decorator';
export type { EventEmitterModuleOptions, OnEventOptions } from './event-emitter.types';
