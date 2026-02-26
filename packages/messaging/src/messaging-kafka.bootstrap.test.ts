/**
 * MessagingKafkaBootstrap tests
 */
import { MessagingKafkaBootstrap } from './messaging-kafka.bootstrap';

jest.mock('@hazeljs/kafka', () => ({
  KafkaConsumer: () => () => {},
  KafkaSubscribe: () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
    descriptor,
  KafkaConsumerService: jest.fn().mockImplementation(() => ({
    registerFromProvider: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('MessagingKafkaBootstrap', () => {
  it('does nothing when useKafka is false', async () => {
    const mockConsumerService = {
      registerFromProvider: jest.fn(),
    };
    const mockConsumer = {};
    const bootstrap = new MessagingKafkaBootstrap(
      mockConsumerService as never,
      mockConsumer as never,
      false
    );

    await bootstrap.onModuleInit();

    expect(mockConsumerService.registerFromProvider).not.toHaveBeenCalled();
  });

  it('registers consumer when useKafka is true', async () => {
    const mockConsumerService = {
      registerFromProvider: jest.fn().mockResolvedValue(undefined),
    };
    const mockConsumer = {};
    const bootstrap = new MessagingKafkaBootstrap(
      mockConsumerService as never,
      mockConsumer as never,
      true
    );

    await bootstrap.onModuleInit();

    expect(mockConsumerService.registerFromProvider).toHaveBeenCalledWith(mockConsumer);
  });
});
