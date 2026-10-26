import { OnChannel, getOnChannelMetadata } from '../on-channel.decorator';
import { RedisModule } from '../redis.module';
import { RedisService } from '../redis.service';
import { RedisPubSub } from '../redis-pubsub.service';
import { Container } from '@hazeljs/core';

class DemoHandler {
  received: unknown[] = [];

  @OnChannel('demo:channel')
  onDemo(payload: unknown): void {
    this.received.push(payload);
  }

  @OnChannel('raw:channel', { parseJson: false })
  onRaw(raw: string): void {
    this.received.push(raw);
  }
}

describe('OnChannel', () => {
  it('stores metadata on the class', () => {
    const handler = new DemoHandler();
    const meta = getOnChannelMetadata(handler);
    expect(meta).toHaveLength(2);
    expect(meta[0]).toMatchObject({
      channel: 'demo:channel',
      methodName: 'onDemo',
      options: { parseJson: true },
    });
    expect(meta[1]).toMatchObject({
      channel: 'raw:channel',
      methodName: 'onRaw',
      options: { parseJson: false },
    });
  });

  it('registerSubscribersFromProvider wires handlers', async () => {
    const messageHandlers: Array<(channel: string, message: string) => void> = [];
    const subscriber = {
      subscribe: jest.fn().mockResolvedValue(1),
      unsubscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') messageHandlers.push(handler);
      }),
    };
    const commandClient = {
      publish: jest.fn().mockResolvedValue(1),
      duplicate: jest.fn().mockReturnValue(subscriber),
    };

    const redis = new RedisService();
    redis.setClient(commandClient as never, false);
    const pubsub = new RedisPubSub(redis);
    pubsub.setSubscriber(subscriber as never);

    const container = Container.getInstance();
    container.register(RedisService, redis);
    container.register(RedisPubSub, pubsub);

    const handler = new DemoHandler();
    await RedisModule.registerSubscribersFromProvider(handler);

    expect(subscriber.subscribe).toHaveBeenCalledWith('demo:channel');
    expect(subscriber.subscribe).toHaveBeenCalledWith('raw:channel');

    messageHandlers[0]('demo:channel', JSON.stringify({ ok: true }));
    messageHandlers[0]('raw:channel', 'plain');

    expect(handler.received).toEqual([{ ok: true }, 'plain']);
  });
});
