import { Injectable, Inject } from '@hazeljs/core';
import { Kafka } from 'kafkajs';
import { KafkaStreamTransform } from './kafka.types';
import logger from '@hazeljs/core';

export const KAFKA_CLIENT_TOKEN = 'KAFKA_CLIENT';

interface StreamPipelineConfig {
  inputTopic: string;
  outputTopic: string;
  transform: KafkaStreamTransform;
  groupId?: string;
}

/**
 * Lightweight Kafka stream processor: consume from topic, transform, produce to output topic
 */
@Injectable()
export class KafkaStreamProcessor {
  private kafka: Kafka;
  private consumer: ReturnType<Kafka['consumer']> | null = null;
  private producer: ReturnType<Kafka['producer']> | null = null;
  private pipelineConfig: StreamPipelineConfig | null = null;
  private isRunning = false;

  constructor(
    @Inject(KAFKA_CLIENT_TOKEN)
    kafka: Kafka
  ) {
    this.kafka = kafka;
  }

  /**
   * Set the input topic to consume from
   */
  from(topic: string): this {
    if (!this.pipelineConfig) {
      this.pipelineConfig = {
        inputTopic: topic,
        outputTopic: '',
        transform: async (msg): Promise<{ value: Buffer | null } | null> => ({
          value: msg.value,
        }),
      };
    } else {
      this.pipelineConfig.inputTopic = topic;
    }
    return this;
  }

  /**
   * Set the transform function
   */
  transform(fn: KafkaStreamTransform): this {
    if (!this.pipelineConfig) {
      throw new Error('Call from(topic) before transform()');
    }
    this.pipelineConfig.transform = fn;
    return this;
  }

  /**
   * Set the output topic to produce to
   */
  to(topic: string): this {
    if (!this.pipelineConfig) {
      throw new Error('Call from(topic) before to()');
    }
    this.pipelineConfig.outputTopic = topic;
    return this;
  }

  /**
   * Set consumer group ID for the stream processor
   */
  withGroupId(groupId: string): this {
    if (!this.pipelineConfig) {
      throw new Error('Call from(topic) before withGroupId()');
    }
    this.pipelineConfig.groupId = groupId;
    return this;
  }

  /**
   * Start the stream processor
   */
  async start(): Promise<void> {
    if (!this.pipelineConfig) {
      throw new Error('Pipeline not configured. Use from().transform().to()');
    }
    if (this.isRunning) {
      logger.warn('Kafka stream processor already running');
      return;
    }

    const { inputTopic, outputTopic, transform } = this.pipelineConfig;
    const groupId = this.pipelineConfig.groupId ?? `stream-${inputTopic}-${outputTopic}`;

    this.consumer = this.kafka.consumer({ groupId });
    this.producer = this.kafka.producer();

    await this.consumer.connect();
    await this.producer.connect();

    await this.consumer.subscribe({ topics: [inputTopic], fromBeginning: false });
    this.isRunning = true;

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const result = await transform({
            key: message.key,
            value: message.value,
            headers: message.headers as Record<string, string>,
          });

          if (result === null) return;

          const outputMessage =
            typeof result === 'object' && result !== null && 'value' in result
              ? (result as {
                  key?: string | Buffer;
                  value: unknown;
                  headers?: Record<string, string>;
                })
              : { value: result };

          const value =
            outputMessage.value === undefined || outputMessage.value === null
              ? message.value
              : typeof outputMessage.value === 'string' || Buffer.isBuffer(outputMessage.value)
                ? outputMessage.value
                : JSON.stringify(outputMessage.value);

          await this.producer!.send({
            topic: outputTopic,
            messages: [
              {
                key: outputMessage.key ?? message.key,
                value,
                headers: outputMessage.headers ?? (message.headers as Record<string, string>),
              },
            ],
          });
        } catch (error) {
          logger.error('Error in stream transform:', error);
          throw error;
        }
      },
    });

    logger.info(
      `Kafka stream processor started: ${inputTopic} -> ${outputTopic} (groupId: ${groupId})`
    );
  }

  /**
   * Stop the stream processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }

    this.isRunning = false;
    this.pipelineConfig = null;
    logger.info('Kafka stream processor stopped');
  }

  /**
   * Check if processor is running
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }
}
