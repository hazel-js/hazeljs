import {
  KafkaConsumer,
  getKafkaConsumerMetadata,
  isKafkaConsumer,
} from '../decorators/kafka-consumer.decorator';
import { KafkaSubscribe, getKafkaSubscribeMetadata } from '../decorators/kafka-subscribe.decorator';

describe('KafkaConsumer decorator', () => {
  it('should set consumer metadata on class', () => {
    @KafkaConsumer({ groupId: 'test-group' })
    class TestConsumer {}

    const metadata = getKafkaConsumerMetadata(TestConsumer.prototype);
    expect(metadata).toBeDefined();
    expect(metadata?.groupId).toBe('test-group');
    expect(metadata?.sessionTimeout).toBe(30000);
  });

  it('should set custom consumer options', () => {
    @KafkaConsumer({
      groupId: 'custom-group',
      sessionTimeout: 60000,
      heartbeatInterval: 5000,
    })
    class CustomConsumer {}

    const metadata = getKafkaConsumerMetadata(CustomConsumer.prototype);
    expect(metadata?.groupId).toBe('custom-group');
    expect(metadata?.sessionTimeout).toBe(60000);
    expect(metadata?.heartbeatInterval).toBe(5000);
  });

  it('should return true for Kafka consumer class', () => {
    @KafkaConsumer({ groupId: 'test' })
    class ConsumerClass {}

    expect(isKafkaConsumer(ConsumerClass.prototype)).toBe(true);
  });

  it('should return false for non-consumer class', () => {
    class RegularClass {}
    expect(isKafkaConsumer(RegularClass.prototype)).toBe(false);
  });
});

describe('KafkaSubscribe decorator', () => {
  it('should set subscribe metadata on method', () => {
    @KafkaConsumer({ groupId: 'test-group' })
    class TestConsumer {
      @KafkaSubscribe('orders')
      handleOrders() {}
    }

    const metadata = getKafkaSubscribeMetadata(TestConsumer.prototype);
    expect(metadata).toHaveLength(1);
    expect(metadata[0].topic).toBe('orders');
    expect(metadata[0].methodName).toBe('handleOrders');
  });

  it('should support multiple topic subscriptions', () => {
    @KafkaConsumer({ groupId: 'test-group' })
    class MultiConsumer {
      @KafkaSubscribe('topic-a')
      handleA() {}

      @KafkaSubscribe('topic-b', { fromBeginning: true })
      handleB() {}
    }

    const metadata = getKafkaSubscribeMetadata(MultiConsumer.prototype);
    expect(metadata).toHaveLength(2);
    expect(metadata[0]).toEqual({ topic: 'topic-a', methodName: 'handleA', options: {} });
    expect(metadata[1].topic).toBe('topic-b');
    expect(metadata[1].options?.fromBeginning).toBe(true);
  });
});
