import { RedisModule } from '../redis.module';
import { RedisService } from '../redis.service';
import { RedisPubSub } from '../redis-pubsub.service';

describe('RedisModule', () => {
  it('forRoot returns module config with providers and exports', () => {
    const mockClient = {
      duplicate: jest.fn().mockReturnValue({
        on: jest.fn(),
        quit: jest.fn(),
      }),
      ping: jest.fn(),
      quit: jest.fn(),
    };

    const config = RedisModule.forRoot({
      client: mockClient as never,
    });

    expect(config.module).toBe(RedisModule);
    expect(config.global).toBe(true);
    expect(config.exports).toContain(RedisService);
    expect(config.exports).toContain(RedisPubSub);
    expect(config.providers).toHaveLength(2);

    const redisProvider = config.providers[0] as {
      useFactory: () => RedisService;
    };
    const service = redisProvider.useFactory();
    expect(service.getClient()).toBe(mockClient);

    const pubSubProvider = config.providers[1] as {
      useFactory: (redis: RedisService) => RedisPubSub;
    };
    const pubsub = pubSubProvider.useFactory(service);
    expect(pubsub).toBeInstanceOf(RedisPubSub);
    expect(mockClient.duplicate).toHaveBeenCalled();
  });

  it('forRoot respects isGlobal false', () => {
    const config = RedisModule.forRoot({
      client: { duplicate: jest.fn().mockReturnValue({ on: jest.fn() }) } as never,
      isGlobal: false,
    });
    expect(config.global).toBe(false);
  });
});
