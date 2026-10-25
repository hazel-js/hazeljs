/**
 * @hazeljs/redis - Shared Redis client and pub/sub for HazelJS
 */

export { RedisModule } from './redis.module';
export { RedisService } from './redis.service';
export { RedisPubSub } from './redis-pubsub.service';
export { OnChannel, getOnChannelMetadata, ON_CHANNEL_METADATA_KEY } from './on-channel.decorator';
export type { OnChannelOptions, OnChannelMetadata } from './on-channel.decorator';
export type {
  RedisModuleOptions,
  RedisConnectionOptions,
  RedisMessageHandler,
} from './redis.types';
