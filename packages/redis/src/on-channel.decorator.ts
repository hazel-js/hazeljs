import 'reflect-metadata';

export const ON_CHANNEL_METADATA_KEY = Symbol('redis:on-channel');

export interface OnChannelOptions {
  /**
   * Parse Redis message as JSON before invoking the handler
   * @default true
   */
  parseJson?: boolean;
}

export interface OnChannelMetadata {
  channel: string;
  methodName: string;
  options: OnChannelOptions;
}

/**
 * Mark a method as a Redis pub/sub channel subscriber.
 * Register with `RedisModule.registerSubscribersFromProvider(instance)`.
 *
 * @example
 * ```typescript
 * @OnChannel('app:space-events')
 * onSpaceEvent(payload: SpaceEvent) {
 *   this.gateway.broadcastToRoom(`space:${payload.spaceId}`, ...);
 * }
 * ```
 */
export function OnChannel(channel: string, options: OnChannelOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing: OnChannelMetadata[] =
      Reflect.getMetadata(ON_CHANNEL_METADATA_KEY, target.constructor) || [];

    existing.push({
      channel,
      methodName: propertyKey.toString(),
      options: {
        parseJson: true,
        ...options,
      },
    });

    Reflect.defineMetadata(ON_CHANNEL_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Get @OnChannel metadata from a provider instance
 */
export function getOnChannelMetadata(target: object): OnChannelMetadata[] {
  return Reflect.getMetadata(ON_CHANNEL_METADATA_KEY, target.constructor) || [];
}
