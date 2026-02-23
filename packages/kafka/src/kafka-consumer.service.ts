import { Injectable, Inject } from '@hazeljs/core';
import { Kafka } from 'kafkajs';
import { getKafkaConsumerMetadata } from './decorators/kafka-consumer.decorator';
import { getKafkaSubscribeMetadata } from './decorators/kafka-subscribe.decorator';
import { KafkaMessagePayload } from './kafka.types';
import logger from '@hazeljs/core';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

interface RunningConsumer {
  consumer: ReturnType<Kafka['consumer']>;
  provider: object;
  topicHandlers: Map<string, { methodName: string; fromBeginning?: boolean }>;
}

/**
 * Kafka consumer service for consuming messages with decorator-driven handlers
 */
@Injectable()
export class KafkaConsumerService {
  private runningConsumers: RunningConsumer[] = [];

  constructor(
    @Inject(KAFKA_CLIENT_TOKEN)
    private readonly kafka: Kafka
  ) {}

  /**
   * Register a consumer provider and start consuming
   * Call this for each class that has @KafkaConsumer and @KafkaSubscribe decorators
   */
  async registerFromProvider(provider: object): Promise<void> {
    const consumerOptions = getKafkaConsumerMetadata(provider.constructor);
    const subscribeMetadata = getKafkaSubscribeMetadata(provider.constructor);

    if (!consumerOptions) {
      logger.warn(
        `Provider ${provider.constructor.name} has @KafkaSubscribe but no @KafkaConsumer decorator - skipping`
      );
      return;
    }

    if (!subscribeMetadata || subscribeMetadata.length === 0) {
      logger.warn(
        `Provider ${provider.constructor.name} has @KafkaConsumer but no @KafkaSubscribe - skipping`
      );
      return;
    }

    const consumer = this.kafka.consumer({
      groupId: consumerOptions.groupId,
      sessionTimeout: consumerOptions.sessionTimeout ?? 30000,
      rebalanceTimeout: consumerOptions.rebalanceTimeout ?? 60000,
      heartbeatInterval: consumerOptions.heartbeatInterval ?? 3000,
      maxWaitTimeInMs: consumerOptions.maxWaitTimeInMs ?? 5000,
      retry: consumerOptions.retry,
    });

    const topicHandlers = new Map<string, { methodName: string; fromBeginning?: boolean }>();

    await consumer.connect();

    for (const sub of subscribeMetadata) {
      topicHandlers.set(sub.topic, {
        methodName: sub.methodName,
        fromBeginning: sub.options?.fromBeginning ?? false,
      });
      await consumer.subscribe({
        topics: [sub.topic],
        fromBeginning: sub.options?.fromBeginning ?? false,
      });
    }

    await consumer.run({
      eachMessage: async (payload) => {
        const handlerConfig = topicHandlers.get(payload.topic);
        if (!handlerConfig) return;

        const instance = provider as Record<
          string,
          (payload: KafkaMessagePayload) => Promise<void>
        >;
        const method = instance[handlerConfig.methodName];
        if (typeof method !== 'function') {
          logger.error(
            `Handler ${handlerConfig.methodName} not found on ${provider.constructor.name}`
          );
          return;
        }

        try {
          await method.call(provider, payload as KafkaMessagePayload);
        } catch (error) {
          logger.error(
            `Error in Kafka handler ${provider.constructor.name}.${handlerConfig.methodName}:`,
            error
          );
        }
      },
    });

    this.runningConsumers.push({
      consumer,
      provider,
      topicHandlers,
    });

    logger.info(
      `Kafka consumer started for ${provider.constructor.name} (groupId: ${consumerOptions.groupId}, topics: ${Array.from(topicHandlers.keys()).join(', ')})`
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const { consumer } of this.runningConsumers) {
      try {
        await consumer.disconnect();
        logger.info('Kafka consumer disconnected');
      } catch (error) {
        logger.error('Error disconnecting Kafka consumer:', error);
      }
    }
    this.runningConsumers = [];
  }

  /**
   * Get count of running consumers
   */
  getConsumerCount(): number {
    return this.runningConsumers.length;
  }
}
