import { HazelModule } from '@hazeljs/core';
import { Kafka } from 'kafkajs';
import { KafkaModuleOptions } from './kafka.types';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaStreamProcessor } from './kafka-stream.processor';
import { KAFKA_CLIENT_TOKEN } from './kafka-producer.service';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';

/**
 * Kafka module for HazelJS
 */
@HazelModule({
  providers: [KafkaProducerService, KafkaConsumerService, KafkaStreamProcessor],
  exports: [KafkaProducerService, KafkaConsumerService, KafkaStreamProcessor],
})
export class KafkaModule {
  /**
   * Configure Kafka module.
   * Registers the Kafka client with the container before module initialization,
   * since HazelJS does not process dynamic module provider configs from forRoot return values.
   */
  static forRoot(options: Partial<KafkaModuleOptions> = {}): typeof KafkaModule {
    const { clientId = 'hazeljs-app', brokers = ['localhost:9092'], ...kafkaOptions } = options;

    logger.info('Configuring Kafka module...');

    const kafkaClient = new Kafka({
      clientId,
      brokers,
      ...kafkaOptions,
    } as import('kafkajs').KafkaConfig);

    Container.getInstance().register(KAFKA_CLIENT_TOKEN, kafkaClient);

    return KafkaModule;
  }

  /**
   * Configure Kafka module asynchronously.
   * Must be awaited before creating the app so the Kafka client is registered.
   */
  static async forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<KafkaModuleOptions> | KafkaModuleOptions;
    inject?: unknown[];
  }): Promise<typeof KafkaModule> {
    const container = Container.getInstance();
    const injectTokens = options.inject ?? [];
    const deps = injectTokens.map((token) =>
      container.resolve(token as Parameters<Container['resolve']>[0])
    );
    const kafkaOptions = await Promise.resolve(options.useFactory(...deps));
    const { clientId = 'hazeljs-app', brokers = ['localhost:9092'], ...rest } = kafkaOptions;
    const kafkaClient = new Kafka({
      clientId,
      brokers,
      ...rest,
    } as import('kafkajs').KafkaConfig);
    container.register(KAFKA_CLIENT_TOKEN, kafkaClient);
    return KafkaModule;
  }

  /**
   * Register Kafka consumers from a provider instance.
   * Call this after the provider has been instantiated (e.g. in bootstrap).
   *
   * @example
   * ```typescript
   * const container = Container.getInstance();
   * const orderConsumer = container.resolve(OrderConsumer);
   * KafkaModule.registerConsumersFromProvider(orderConsumer);
   * ```
   */
  static async registerConsumersFromProvider(provider: object): Promise<void> {
    try {
      const container = Container.getInstance();
      const consumerService = container.resolve(KafkaConsumerService);

      if (!consumerService) {
        logger.warn('KafkaConsumerService not found in DI container');
        return;
      }

      await consumerService.registerFromProvider(provider);
      logger.info(`Registered Kafka consumer from provider: ${provider.constructor.name}`);
    } catch (error) {
      logger.error('Error registering Kafka consumers from provider:', error);
    }
  }
}
