import 'reflect-metadata';
import { PubSubSubscribeMetadata, PubSubSubscribeOptions } from '../pubsub.types';
import logger from '@hazeljs/core';

export const PUBSUB_SUBSCRIBE_METADATA_KEY = Symbol('pubsub:subscribe');

export function PubSubSubscribe(options: PubSubSubscribeOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existingSubscriptions: PubSubSubscribeMetadata[] =
      Reflect.getMetadata(PUBSUB_SUBSCRIBE_METADATA_KEY, target.constructor) || [];

    const subscription: PubSubSubscribeMetadata = {
      methodName: propertyKey.toString(),
      options,
    };

    existingSubscriptions.push(subscription);
    Reflect.defineMetadata(
      PUBSUB_SUBSCRIBE_METADATA_KEY,
      existingSubscriptions,
      target.constructor
    );

    logger.debug(
      `PubSubSubscribe applied to ${target.constructor.name}.${String(propertyKey)} for subscription: ${options.subscription}`
    );
  };
}

export function getPubSubSubscribeMetadata(target: object): PubSubSubscribeMetadata[] {
  const constructor =
    typeof target === 'function' ? target : (target as { constructor?: object }).constructor;
  if (!constructor) return [];
  return Reflect.getMetadata(PUBSUB_SUBSCRIBE_METADATA_KEY, constructor as object) || [];
}
