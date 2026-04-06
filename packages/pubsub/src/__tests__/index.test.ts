import * as pubsub from '../index';

describe('public index exports', () => {
  it('exports module, services, decorators, and tokens', () => {
    expect(pubsub.PubSubModule).toBeDefined();
    expect(pubsub.PubSubPublisherService).toBeDefined();
    expect(pubsub.PubSubSubscriberService).toBeDefined();
    expect(pubsub.PUBSUB_CLIENT_TOKEN).toBe('PUBSUB_CLIENT');
    expect(pubsub.PubSubConsumer).toBeDefined();
    expect(pubsub.PubSubSubscribe).toBeDefined();
    expect(pubsub.getPubSubConsumerMetadata).toBeDefined();
    expect(pubsub.getPubSubSubscribeMetadata).toBeDefined();
  });
});
