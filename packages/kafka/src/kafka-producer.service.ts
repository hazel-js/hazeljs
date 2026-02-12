import { Injectable, Inject } from '@hazeljs/core';
import { Kafka } from 'kafkajs';
import { KafkaMessage, KafkaProduceOptions } from './kafka.types';
import logger from '@hazeljs/core';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

/**
 * Kafka producer service for publishing messages to topics
 */
@Injectable()
export class KafkaProducerService {
  private producer: ReturnType<Kafka['producer']>;
  private isConnected = false;

  constructor(
    @Inject(KAFKA_CLIENT_TOKEN)
    private readonly kafka: Kafka
  ) {
    this.producer = this.kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Connect producer (called automatically on first send if not already connected)
   */
  private async connect(): Promise<void> {
    if (this.isConnected) return;
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected');
    } catch (error) {
      logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka producer:', error);
      throw error;
    }
  }

  /**
   * Send messages to a topic
   */
  async send(
    topic: string,
    messages: KafkaMessage | KafkaMessage[],
    options?: KafkaProduceOptions
  ): Promise<void> {
    await this.connect();

    const messageArray = Array.isArray(messages) ? messages : [messages];
    const formattedMessages = messageArray.map((msg) => {
      const value = msg.value ?? null;
      return {
        key: msg.key ?? undefined,
        value: value as string | Buffer | null,
        headers: msg.headers ?? undefined,
        partition: msg.partition ?? undefined,
        timestamp: msg.timestamp ?? undefined,
      };
    });

    await this.producer.send({
      topic,
      messages: formattedMessages,
      acks: options?.acks ?? -1,
      timeout: options?.timeout ?? 30000,
      compression: options?.compression ?? 0,
    });

    logger.debug(`Sent ${formattedMessages.length} message(s) to topic: ${topic}`);
  }

  /**
   * Send a batch of messages to multiple topics
   */
  async sendBatch(
    batch: Array<{
      topic: string;
      messages: KafkaMessage | KafkaMessage[];
      options?: KafkaProduceOptions;
    }>
  ): Promise<void> {
    await this.connect();

    await Promise.all(
      batch.map(({ topic, messages, options }) => this.send(topic, messages, options))
    );
    logger.debug(`Sent batch to ${batch.length} topic(s)`);
  }

  /**
   * Check if producer is connected
   */
  isProducerConnected(): boolean {
    return this.isConnected;
  }
}
