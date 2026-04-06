import { PubSubSubscriberService } from '../pubsub-subscriber.service';
import { getPubSubConsumerMetadata } from '../decorators/pubsub-consumer.decorator';
import { getPubSubSubscribeMetadata } from '../decorators/pubsub-subscribe.decorator';

jest.mock('../decorators/pubsub-consumer.decorator', () => ({
  getPubSubConsumerMetadata: jest.fn(),
  PUBSUB_CONSUMER_METADATA_KEY: Symbol('pubsub:consumer'),
}));

jest.mock('../decorators/pubsub-subscribe.decorator', () => ({
  getPubSubSubscribeMetadata: jest.fn(),
  PUBSUB_SUBSCRIBE_METADATA_KEY: Symbol('pubsub:subscribe'),
}));

const mockOn = jest.fn();
const mockRemoveListener = jest.fn();
const mockExists = jest.fn().mockResolvedValue([true]);
const mockSubscription = {
  on: mockOn,
  removeListener: mockRemoveListener,
  exists: mockExists,
};

const mockCreateSubscription = jest.fn().mockResolvedValue([{}]);
const mockTopic = jest.fn().mockReturnValue({
  createSubscription: mockCreateSubscription,
});

const mockPubSub = {
  subscription: jest.fn().mockReturnValue(mockSubscription),
  topic: mockTopic,
};

const mockGetConsumerMetadata = getPubSubConsumerMetadata as jest.Mock;
const mockGetSubscribeMetadata = getPubSubSubscribeMetadata as jest.Mock;

describe('PubSubSubscriberService', () => {
  let service: PubSubSubscriberService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExists.mockResolvedValue([true]);
    service = new PubSubSubscriberService(mockPubSub as never);
  });

  it('returns when provider has no @PubSubConsumer metadata', async () => {
    mockGetConsumerMetadata.mockReturnValue(undefined);
    mockGetSubscribeMetadata.mockReturnValue([]);

    class Provider {}
    await service.registerFromProvider(new Provider());

    expect(mockPubSub.subscription).not.toHaveBeenCalled();
  });

  it('returns when provider has no @PubSubSubscribe metadata', async () => {
    mockGetConsumerMetadata.mockReturnValue({ ackOnSuccess: true });
    mockGetSubscribeMetadata.mockReturnValue([]);

    class Provider {}
    await service.registerFromProvider(new Provider());

    expect(mockPubSub.subscription).not.toHaveBeenCalled();
  });

  it('registers and wires message handlers', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: true,
      nackOnError: true,
      parseJson: true,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<void> {}
    }

    await service.registerFromProvider(new Provider());

    expect(mockPubSub.subscription).toHaveBeenCalledWith('orders-sub');
    expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
    expect(service.getSubscriptionCount()).toBe(1);
  });

  it('skips registration when method does not exist on provider', async () => {
    mockGetConsumerMetadata.mockReturnValue({ ackOnSuccess: true });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'missingMethod', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {}

    await service.registerFromProvider(new Provider());

    expect(mockOn).not.toHaveBeenCalled();
    expect(service.getSubscriptionCount()).toBe(0);
  });

  it('acks on successful handler completion by default', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: true,
      nackOnError: true,
      parseJson: true,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    const handleSpy = jest.fn().mockResolvedValue(undefined);
    class Provider {
      async handleMessage(payload: unknown): Promise<void> {
        handleSpy(payload);
      }
    }

    await service.registerFromProvider(new Provider());

    const messageHandler = mockOn.mock.calls.find((call) => call[0] === 'message')?.[1] as (
      message: unknown
    ) => Promise<void>;
    const ack = jest.fn();
    const nack = jest.fn();

    await messageHandler({
      data: Buffer.from(JSON.stringify({ id: 1 })),
      attributes: {},
      id: 'm-1',
      ack,
      nack,
    });

    expect(handleSpy).toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();
  });

  it('nacks on handler error when enabled', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: true,
      nackOnError: true,
      parseJson: true,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<void> {
        throw new Error('failed');
      }
    }

    await service.registerFromProvider(new Provider());

    const messageHandler = mockOn.mock.calls.find((call) => call[0] === 'message')?.[1] as (
      message: unknown
    ) => Promise<void>;
    const ack = jest.fn();
    const nack = jest.fn();

    await messageHandler({
      data: Buffer.from('test'),
      attributes: {},
      id: 'm-2',
      ack,
      nack,
    });

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledTimes(1);
  });

  it('does not nack on handler error when nackOnError is false', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: true,
      nackOnError: false,
      parseJson: true,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<void> {
        throw new Error('failed');
      }
    }

    await service.registerFromProvider(new Provider());

    const messageHandler = mockOn.mock.calls.find((call) => call[0] === 'message')?.[1] as (
      message: unknown
    ) => Promise<void>;
    const ack = jest.fn();
    const nack = jest.fn();

    await messageHandler({
      data: Buffer.from('test'),
      attributes: {},
      id: 'm-3',
      ack,
      nack,
    });

    expect(ack).not.toHaveBeenCalled();
    expect(nack).not.toHaveBeenCalled();
  });

  it('nacks when handler explicitly returns "nack"', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: true,
      nackOnError: true,
      parseJson: true,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<'nack'> {
        return 'nack';
      }
    }

    await service.registerFromProvider(new Provider());

    const messageHandler = mockOn.mock.calls.find((call) => call[0] === 'message')?.[1] as (
      message: unknown
    ) => Promise<void>;
    const ack = jest.fn();
    const nack = jest.fn();

    await messageHandler({
      data: Buffer.from('test'),
      attributes: {},
      id: 'm-4',
      ack,
      nack,
    });

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledTimes(1);
  });

  it('passes publish metadata and supports manual ack/nack in payload', async () => {
    mockGetConsumerMetadata.mockReturnValue({
      ackOnSuccess: false,
      nackOnError: true,
      parseJson: false,
    });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    const capturedPayloads: unknown[] = [];
    class Provider {
      async handleMessage(payload: {
        data: unknown;
        orderingKey?: string;
        publishTime?: Date;
        ack: () => void;
        nack: () => void;
      }): Promise<'ack'> {
        capturedPayloads.push(payload);
        payload.ack();
        payload.nack();
        return 'ack';
      }
    }

    await service.registerFromProvider(new Provider());

    const messageHandler = mockOn.mock.calls.find((call) => call[0] === 'message')?.[1] as (
      message: unknown
    ) => Promise<void>;
    const ack = jest.fn();
    const nack = jest.fn();

    await messageHandler({
      data: Buffer.from('plain text'),
      attributes: { source: 'test' },
      id: 'm-5',
      orderingKey: 'order-123',
      publishTime: '2026-01-01T00:00:00.000Z',
      ack,
      nack,
    });

    expect(capturedPayloads).toHaveLength(1);
    const payload = capturedPayloads[0] as {
      data: unknown;
      orderingKey?: string;
      publishTime?: Date;
    };
    expect(payload.data).toBe('plain text');
    expect(payload.orderingKey).toBe('order-123');
    expect(payload.publishTime).toBeInstanceOf(Date);
    expect(ack).toHaveBeenCalled();
    expect(nack).toHaveBeenCalled();
  });

  it('supports auto-creating subscriptions', async () => {
    mockGetConsumerMetadata.mockReturnValue({ autoCreateSubscription: true });
    mockGetSubscribeMetadata.mockReturnValue([
      {
        methodName: 'handleMessage',
        options: {
          subscription: 'new-subscription',
          topic: 'orders',
          autoCreateSubscription: true,
        },
      },
    ]);
    mockExists.mockResolvedValue([false]);

    class Provider {
      async handleMessage(): Promise<void> {}
    }

    await service.registerFromProvider(new Provider());

    expect(mockCreateSubscription).toHaveBeenCalledWith('new-subscription');
  });

  it('throws when auto-create is enabled without topic', async () => {
    mockGetConsumerMetadata.mockReturnValue({ autoCreateSubscription: true });
    mockGetSubscribeMetadata.mockReturnValue([
      {
        methodName: 'handleMessage',
        options: {
          subscription: 'new-subscription',
          autoCreateSubscription: true,
        },
      },
    ]);
    mockExists.mockResolvedValue([false]);

    class Provider {
      async handleMessage(): Promise<void> {}
    }

    await expect(service.registerFromProvider(new Provider())).rejects.toThrow(/without a topic/i);
  });

  it('cleans up listeners on destroy', async () => {
    mockGetConsumerMetadata.mockReturnValue({ ackOnSuccess: true });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<void> {}
    }

    await service.registerFromProvider(new Provider());
    await service.onModuleDestroy();

    expect(mockRemoveListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(service.getSubscriptionCount()).toBe(0);
  });

  it('handles removeListener errors during destroy', async () => {
    mockGetConsumerMetadata.mockReturnValue({ ackOnSuccess: true });
    mockGetSubscribeMetadata.mockReturnValue([
      { methodName: 'handleMessage', options: { subscription: 'orders-sub' } },
    ]);

    class Provider {
      async handleMessage(): Promise<void> {}
    }

    await service.registerFromProvider(new Provider());
    mockRemoveListener.mockImplementationOnce(() => {
      throw new Error('remove failed');
    });

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(service.getSubscriptionCount()).toBe(0);
  });
});
