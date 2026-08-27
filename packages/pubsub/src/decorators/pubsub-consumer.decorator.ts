import { PubSubConsumerOptions } from '../pubsub.types';
import logger from '@hazeljs/core';

export const PUBSUB_CONSUMER_METADATA_KEY = Symbol('pubsub:consumer');

export function PubSubConsumer(options: PubSubConsumerOptions = {}): ClassDecorator {
  return (target: object) => {
    const defaults: PubSubConsumerOptions = {
      ackOnSuccess: options.ackOnSuccess ?? true,
      nackOnError: options.nackOnError ?? true,
      parseJson: options.parseJson ?? true,
      autoCreateSubscription: options.autoCreateSubscription ?? false,
    };

    const targetName = typeof target === 'function' ? target.name : 'unknown';
    logger.debug(`Marking ${targetName} as Pub/Sub consumer`);
    Reflect.defineMetadata(PUBSUB_CONSUMER_METADATA_KEY, defaults, target);
  };
}

export function getPubSubConsumerMetadata(target: object): PubSubConsumerOptions | undefined {
  const constructor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  if (!constructor) return undefined;
  return Reflect.getMetadata(PUBSUB_CONSUMER_METADATA_KEY, constructor as object);
}

export function isPubSubConsumer(target: object): boolean {
  const constructor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  if (!constructor) return false;
  return Reflect.hasMetadata(PUBSUB_CONSUMER_METADATA_KEY, constructor as object);
}
