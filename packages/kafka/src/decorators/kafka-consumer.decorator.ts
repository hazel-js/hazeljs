import 'reflect-metadata';
import { KafkaConsumerOptions } from '../kafka.types';
import logger from '@hazeljs/core';

/**
 * Metadata key for Kafka consumer class options
 */
export const KAFKA_CONSUMER_METADATA_KEY = Symbol('kafka:consumer');

/**
 * Decorator to mark a class as a Kafka consumer with consumer group options
 *
 * @example
 * ```typescript
 * @KafkaConsumer({ groupId: 'order-processor' })
 * @Injectable()
 * export class OrderConsumer {
 *   @KafkaSubscribe('orders')
 *   async handleOrder({ message }: KafkaMessagePayload) {
 *     const order = JSON.parse(message.value.toString());
 *     // process order
 *   }
 * }
 * ```
 */
export function KafkaConsumer(options: KafkaConsumerOptions): ClassDecorator {
  return (target: object) => {
    const defaults: KafkaConsumerOptions = {
      groupId: options.groupId,
      sessionTimeout: options.sessionTimeout ?? 30000,
      rebalanceTimeout: options.rebalanceTimeout ?? 60000,
      heartbeatInterval: options.heartbeatInterval ?? 3000,
      maxWaitTimeInMs: options.maxWaitTimeInMs ?? 5000,
      retry: options.retry,
    };

    const targetName = typeof target === 'function' ? target.name : 'unknown';
    logger.debug(`Marking ${targetName} as Kafka consumer with groupId: ${defaults.groupId}`);
    Reflect.defineMetadata(KAFKA_CONSUMER_METADATA_KEY, defaults, target);
  };
}

/**
 * Get Kafka consumer metadata from a class or instance
 */
export function getKafkaConsumerMetadata(target: object): KafkaConsumerOptions | undefined {
  const constructor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  if (!constructor) return undefined;
  return Reflect.getMetadata(KAFKA_CONSUMER_METADATA_KEY, constructor as object);
}

/**
 * Check if a class is a Kafka consumer
 */
export function isKafkaConsumer(target: object): boolean {
  const constructor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  if (!constructor) return false;
  return Reflect.hasMetadata(KAFKA_CONSUMER_METADATA_KEY, constructor as object);
}
