import { RedisPubSub } from '../redis-pubsub.service';
import { RedisService } from '../redis.service';

describe('RedisPubSub', () => {
  let redis: RedisService;
  let pubsub: RedisPubSub;
  let commandClient: {
    publish: jest.Mock;
    duplicate: jest.Mock;
  };
  let subscriber: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
  };
  let messageHandler: ((channel: string, message: string) => void) | null;

  beforeEach(() => {
    messageHandler = null;
    subscriber = {
      subscribe: jest.fn().mockResolvedValue(1),
      unsubscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn((event: string, handler: (channel: string, message: string) => void) => {
        if (event === 'message') messageHandler = handler;
      }),
    };
    commandClient = {
      publish: jest.fn().mockResolvedValue(2),
      duplicate: jest.fn().mockReturnValue(subscriber),
    };
    redis = new RedisService();
    redis.setClient(commandClient as never, false);
    pubsub = new RedisPubSub(redis);
  });

  it('publish stringifies objects', async () => {
    await pubsub.publish('ch', { a: 1 });
    expect(commandClient.publish).toHaveBeenCalledWith('ch', JSON.stringify({ a: 1 }));
  });

  it('publish passes strings through', async () => {
    await pubsub.publish('ch', 'raw');
    expect(commandClient.publish).toHaveBeenCalledWith('ch', 'raw');
  });

  it('subscribe attaches handler and receives messages', async () => {
    const received: string[] = [];
    await pubsub.subscribe('space', (msg) => {
      received.push(msg);
    });
    expect(subscriber.subscribe).toHaveBeenCalledWith('space');
    expect(messageHandler).toBeTruthy();
    messageHandler!('space', '{"ok":true}');
    expect(received).toEqual(['{"ok":true}']);
  });

  it('does not re-subscribe Redis for a second handler on same channel', async () => {
    await pubsub.subscribe('space', () => undefined);
    await pubsub.subscribe('space', () => undefined);
    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes handler and leaves Redis when empty', async () => {
    const h = (): void => undefined;
    await pubsub.subscribe('space', h);
    await pubsub.unsubscribe('space', h);
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('space');
  });

  it('disconnect closes subscriber', async () => {
    await pubsub.subscribe('space', () => undefined);
    await pubsub.disconnect();
    expect(subscriber.quit).toHaveBeenCalled();
  });

  it('setSubscriber uses provided client', async () => {
    const customSub = {
      subscribe: jest.fn().mockResolvedValue(1),
      unsubscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    };
    const ps = new RedisPubSub(redis);
    ps.setSubscriber(customSub as never);
    await ps.subscribe('x', () => undefined);
    expect(customSub.subscribe).toHaveBeenCalledWith('x');
    expect(commandClient.duplicate).not.toHaveBeenCalled();
  });
});
