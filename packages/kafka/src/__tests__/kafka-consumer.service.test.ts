import { KafkaConsumerService } from '../kafka-consumer.service';
import { getKafkaConsumerMetadata } from '../decorators/kafka-consumer.decorator';
import { getKafkaSubscribeMetadata } from '../decorators/kafka-subscribe.decorator';

// Mock metadata reader functions to control what the service sees
jest.mock('../decorators/kafka-consumer.decorator', () => ({
  getKafkaConsumerMetadata: jest.fn(),
  KAFKA_CONSUMER_METADATA_KEY: Symbol('kafka:consumer'),
}));

jest.mock('../decorators/kafka-subscribe.decorator', () => ({
  getKafkaSubscribeMetadata: jest.fn(),
  KAFKA_SUBSCRIBE_METADATA_KEY: Symbol('kafka:subscribe'),
}));

// Mock kafkajs
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockSubscribe = jest.fn().mockResolvedValue(undefined);
let capturedEachMessage: ((payload: unknown) => Promise<void>) | undefined;
const mockRun = jest
  .fn()
  .mockImplementation(async ({ eachMessage }: { eachMessage: (p: unknown) => Promise<void> }) => {
    capturedEachMessage = eachMessage;
  });

jest.mock('kafkajs', () => ({ Kafka: jest.fn() }));

const mockConsumer = {
  connect: mockConnect,
  disconnect: mockDisconnect,
  subscribe: mockSubscribe,
  run: mockRun,
};

const mockKafka = {
  consumer: jest.fn().mockReturnValue(mockConsumer),
};

const mockGetConsumerMetadata = getKafkaConsumerMetadata as jest.Mock;
const mockGetSubscribeMetadata = getKafkaSubscribeMetadata as jest.Mock;

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedEachMessage = undefined;
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockSubscribe.mockResolvedValue(undefined);
    mockRun.mockImplementation(
      async ({ eachMessage }: { eachMessage: (p: unknown) => Promise<void> }) => {
        capturedEachMessage = eachMessage;
      }
    );
    mockKafka.consumer.mockReturnValue(mockConsumer);
    service = new KafkaConsumerService(mockKafka as never);
  });

  describe('getConsumerCount()', () => {
    it('returns 0 initially', () => {
      expect(service.getConsumerCount()).toBe(0);
    });
  });

  describe('registerFromProvider()', () => {
    it('warns and returns when provider has no @KafkaConsumer', async () => {
      mockGetConsumerMetadata.mockReturnValue(undefined);
      mockGetSubscribeMetadata.mockReturnValue([]);

      class NoMetadataProvider {}
      await service.registerFromProvider(new NoMetadataProvider());

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('warns and returns when provider has @KafkaConsumer but empty @KafkaSubscribe', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'test-group' });
      mockGetSubscribeMetadata.mockReturnValue([]);

      class NoSubscribeProvider {}
      await service.registerFromProvider(new NoSubscribeProvider());

      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('registers and starts a consumer', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'test-group' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'test-topic', methodName: 'handleMessage', options: {} },
      ]);

      class TestProvider {
        async handleMessage(_payload: unknown): Promise<void> {}
      }

      await service.registerFromProvider(new TestProvider());

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith({ topics: ['test-topic'], fromBeginning: false });
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(service.getConsumerCount()).toBe(1);
    });

    it('subscribes with fromBeginning=true when specified', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'replay-group' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'replay-topic', methodName: 'handle', options: { fromBeginning: true } },
      ]);

      class ReplayProvider {
        async handle(_payload: unknown): Promise<void> {}
      }

      await service.registerFromProvider(new ReplayProvider());

      expect(mockSubscribe).toHaveBeenCalledWith({ topics: ['replay-topic'], fromBeginning: true });
    });

    it('passes consumer options to kafka.consumer()', async () => {
      mockGetConsumerMetadata.mockReturnValue({
        groupId: 'my-group',
        sessionTimeout: 10000,
        rebalanceTimeout: 20000,
        heartbeatInterval: 1000,
        maxWaitTimeInMs: 2000,
      });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'topic', methodName: 'handle', options: {} },
      ]);

      class Provider {
        async handle(_payload: unknown): Promise<void> {}
      }

      await service.registerFromProvider(new Provider());

      expect(mockKafka.consumer).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'my-group', sessionTimeout: 10000 })
      );
    });

    it('dispatches eachMessage to the correct handler', async () => {
      const handleSpy = jest.fn().mockResolvedValue(undefined);
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'order-group' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'orders', methodName: 'processOrder', options: {} },
      ]);

      class OrderProvider {
        async processOrder(payload: unknown): Promise<void> {
          handleSpy(payload);
        }
      }

      const provider = new OrderProvider();
      await service.registerFromProvider(provider);

      expect(capturedEachMessage).toBeDefined();
      const testPayload = {
        topic: 'orders',
        partition: 0,
        message: {
          key: null,
          value: Buffer.from('{"id":1}'),
          headers: {},
          offset: '0',
          timestamp: '1000',
        },
        heartbeat: jest.fn(),
        pause: jest.fn(),
      };
      await capturedEachMessage!(testPayload);

      expect(handleSpy).toHaveBeenCalledWith(testPayload);
    });

    it('ignores messages for unregistered topics', async () => {
      const handleSpy = jest.fn();
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'g' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'known-topic', methodName: 'handle', options: {} },
      ]);

      class Provider {
        async handle(): Promise<void> {
          handleSpy();
        }
      }

      await service.registerFromProvider(new Provider());

      await capturedEachMessage!({
        topic: 'unknown-topic',
        partition: 0,
        message: { key: null, value: Buffer.from('x'), headers: {}, offset: '0', timestamp: '0' },
        heartbeat: jest.fn(),
        pause: jest.fn(),
      });

      expect(handleSpy).not.toHaveBeenCalled();
    });

    it('handles handler errors gracefully without throwing', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'g' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'error-topic', methodName: 'handle', options: {} },
      ]);

      class ErrorProvider {
        async handle(): Promise<void> {
          throw new Error('handler blew up');
        }
      }

      await service.registerFromProvider(new ErrorProvider());

      await expect(
        capturedEachMessage!({
          topic: 'error-topic',
          partition: 0,
          message: { key: null, value: Buffer.from('x'), headers: {}, offset: '0', timestamp: '0' },
          heartbeat: jest.fn(),
          pause: jest.fn(),
        })
      ).resolves.toBeUndefined();
    });

    it('logs error when method name is not a function on provider', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'g' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'test-topic', methodName: 'nonExistentMethod', options: {} },
      ]);

      class ProviderWithoutMethod {}

      await service.registerFromProvider(new ProviderWithoutMethod());

      // Should not throw, just log an error
      await expect(
        capturedEachMessage!({
          topic: 'test-topic',
          partition: 0,
          message: { key: null, value: Buffer.from('x'), headers: {}, offset: '0', timestamp: '0' },
          heartbeat: jest.fn(),
          pause: jest.fn(),
        })
      ).resolves.toBeUndefined();
    });

    it('supports multiple subscriptions on one provider', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'multi-group' });
      mockGetSubscribeMetadata.mockReturnValue([
        { topic: 'topic-a', methodName: 'handleA', options: {} },
        { topic: 'topic-b', methodName: 'handleB', options: {} },
      ]);

      class MultiProvider {
        async handleA(_p: unknown): Promise<void> {}
        async handleB(_p: unknown): Promise<void> {}
      }

      await service.registerFromProvider(new MultiProvider());

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('onModuleDestroy()', () => {
    it('does nothing when no consumers are running', async () => {
      await service.onModuleDestroy();
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('disconnects all running consumers and clears list', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'g' });
      mockGetSubscribeMetadata.mockReturnValue([{ topic: 't', methodName: 'h', options: {} }]);

      class P {
        async h(): Promise<void> {}
      }

      await service.registerFromProvider(new P());
      expect(service.getConsumerCount()).toBe(1);

      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(service.getConsumerCount()).toBe(0);
    });

    it('handles disconnect errors gracefully', async () => {
      mockGetConsumerMetadata.mockReturnValue({ groupId: 'g' });
      mockGetSubscribeMetadata.mockReturnValue([{ topic: 't', methodName: 'h', options: {} }]);

      class P {
        async h(): Promise<void> {}
      }

      await service.registerFromProvider(new P());
      mockDisconnect.mockRejectedValueOnce(new Error('disconnect failed'));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
