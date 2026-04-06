import {
  PubSubConsumer,
  getPubSubConsumerMetadata,
  isPubSubConsumer,
} from '../decorators/pubsub-consumer.decorator';
import {
  PubSubSubscribe,
  getPubSubSubscribeMetadata,
} from '../decorators/pubsub-subscribe.decorator';

describe('PubSubConsumer decorator', () => {
  it('sets default consumer metadata', () => {
    @PubSubConsumer()
    class TestConsumer {}

    const metadata = getPubSubConsumerMetadata(TestConsumer.prototype);
    expect(metadata).toBeDefined();
    expect(metadata?.ackOnSuccess).toBe(true);
    expect(metadata?.nackOnError).toBe(true);
    expect(metadata?.parseJson).toBe(true);
  });

  it('sets custom consumer metadata', () => {
    @PubSubConsumer({ ackOnSuccess: false, parseJson: false })
    class CustomConsumer {}

    const metadata = getPubSubConsumerMetadata(CustomConsumer.prototype);
    expect(metadata?.ackOnSuccess).toBe(false);
    expect(metadata?.parseJson).toBe(false);
  });

  it('identifies pubsub consumer classes', () => {
    @PubSubConsumer()
    class ConsumerClass {}
    expect(isPubSubConsumer(ConsumerClass.prototype)).toBe(true);
  });

  it('returns false for non-consumer classes', () => {
    class RegularClass {}
    expect(isPubSubConsumer(RegularClass.prototype)).toBe(false);
  });
});

describe('PubSubSubscribe decorator', () => {
  it('stores subscription metadata on method', () => {
    class TestConsumer {
      @PubSubSubscribe({ subscription: 'orders-sub' })
      handleOrders() {}
    }

    const metadata = getPubSubSubscribeMetadata(TestConsumer.prototype);
    expect(metadata).toHaveLength(1);
    expect(metadata[0].methodName).toBe('handleOrders');
    expect(metadata[0].options.subscription).toBe('orders-sub');
  });

  it('supports multiple subscription handlers', () => {
    class MultiConsumer {
      @PubSubSubscribe({ subscription: 'sub-a' })
      handleA() {}

      @PubSubSubscribe({ subscription: 'sub-b', parseJson: false })
      handleB() {}
    }

    const metadata = getPubSubSubscribeMetadata(MultiConsumer.prototype);
    expect(metadata).toHaveLength(2);
    expect(metadata[0].options.subscription).toBe('sub-a');
    expect(metadata[1].options.subscription).toBe('sub-b');
    expect(metadata[1].options.parseJson).toBe(false);
  });
});
