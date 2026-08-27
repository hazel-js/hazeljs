import 'reflect-metadata';
import { KafkaSubscribeOptions } from '../kafka.types';
import logger from '@hazeljs/core';

/**
 * Metadata key for Kafka subscribe (topic + handler)
 */
export const KAFKA_SUBSCRIBE_METADATA_KEY = Symbol('kafka:subscribe');

/**
 * Subscribe handler metadata
 */
export interface KafkaSubscribeMetadata {
  topic: string;
  methodName: string;
  options?: KafkaSubscribeOptions;
}

/**
 * Decorator to mark a method as a handler for a Kafka topic
 *
 * @example
 * ```typescript
 * @KafkaConsumer({ groupId: 'order-processor' })
 * @Injectable()
 * export class OrderConsumer {
 *   @KafkaSubscribe('orders')
 *   async handleOrder({ message }: KafkaMessagePayload) {
 *     // process order
 *   }
 *
 *   @KafkaSubscribe('events', { fromBeginning: true })
 *   async handleEvents({ message }: KafkaMessagePayload) {
 *     // process events
 *   }
 * }
 * ```
 */
export function KafkaSubscribe(topic: string, options?: KafkaSubscribeOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existingSubscriptions: KafkaSubscribeMetadata[] =
      Reflect.getMetadata(KAFKA_SUBSCRIBE_METADATA_KEY, target.constructor) || [];

    const subscription: KafkaSubscribeMetadata = {
      topic,
      methodName: propertyKey.toString(),
      options: options ?? {},
    };

    existingSubscriptions.push(subscription);
    Reflect.defineMetadata(KAFKA_SUBSCRIBE_METADATA_KEY, existingSubscriptions, target.constructor);

    logger.debug(
      `KafkaSubscribe applied to ${target.constructor.name}.${String(propertyKey)} for topic: ${topic}`
    );
  };
}

/**
 * Get Kafka subscribe metadata from a class
 */
export function getKafkaSubscribeMetadata(target: object): KafkaSubscribeMetadata[] {
  return Reflect.getMetadata(KAFKA_SUBSCRIBE_METADATA_KEY, target.constructor) || [];
}
