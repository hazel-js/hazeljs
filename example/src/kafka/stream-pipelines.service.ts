import { Injectable, Inject } from '@hazeljs/core';
import { KafkaStreamProcessor, KAFKA_CLIENT_TOKEN } from '@hazeljs/kafka';
import { Kafka } from 'kafkajs';
import logger from '@hazeljs/core';

/**
 * Comprehensive Kafka Streams example service.
 * Demonstrates multiple stream patterns: enrichment, filtering, and transformation.
 *
 * Each pipeline uses a dedicated KafkaStreamProcessor instance since one processor
 * handles a single input->transform->output flow.
 */
@Injectable()
export class StreamPipelinesService {
  private processors: KafkaStreamProcessor[] = [];

  constructor(
    @Inject(KAFKA_CLIENT_TOKEN)
    private readonly kafka: Kafka
  ) {}

  /**
   * Start all stream pipelines.
   * Call this after the app is bootstrapped.
   */
  async startAllPipelines(): Promise<void> {
    await this.startEnrichmentPipeline();
    await this.startFilterPipeline();
    await this.startTransformPipeline();
  }

  /**
   * Stop all running pipelines.
   */
  async stopAllPipelines(): Promise<void> {
    for (const processor of this.processors) {
      if (processor.isProcessorRunning()) {
        await processor.stop();
      }
    }
    this.processors = [];
    logger.info('All stream pipelines stopped');
  }

  /**
   * Pipeline 1: Enrichment
   * Adds computed fields (processedAt, orderCount) to incoming orders.
   * Input: orders
   * Output: enriched-orders
   */
  private async startEnrichmentPipeline(): Promise<void> {
    const processor = new KafkaStreamProcessor(this.kafka);
    this.processors.push(processor);

    processor
      .from('orders')
      .withGroupId('stream-enrichment')
      .transform(async (msg) => {
        if (!msg.value) return null;
        const order = JSON.parse(msg.value.toString());
        return {
          key: msg.key,
          value: JSON.stringify({
            ...order,
            processedAt: new Date().toISOString(),
            enriched: true,
            orderCount: order.items?.length ?? 0,
          }),
          headers: { ...msg.headers, 'x-pipeline': 'enrichment' },
        };
      })
      .to('enriched-orders');

    await processor.start();
    logger.info('Enrichment pipeline started: orders -> enriched-orders');
  }

  /**
   * Pipeline 2: Filter
   * Forwards only high-value orders (total >= 100).
   * Input: enriched-orders
   * Output: high-value-orders
   */
  private async startFilterPipeline(): Promise<void> {
    const processor = new KafkaStreamProcessor(this.kafka);
    this.processors.push(processor);

    processor
      .from('enriched-orders')
      .withGroupId('stream-filter')
      .transform(async (msg) => {
        if (!msg.value) return null;
        const order = JSON.parse(msg.value.toString());
        if (order.total >= 100) {
          return {
            key: msg.key,
            value: msg.value,
            headers: { ...msg.headers, 'x-pipeline': 'filter', 'x-high-value': 'true' },
          };
        }
        return null;
      })
      .to('high-value-orders');

    await processor.start();
    logger.info('Filter pipeline started: enriched-orders -> high-value-orders');
  }

  /**
   * Pipeline 3: Transformation
   * Normalizes order-events into a standard schema.
   * Input: order-events
   * Output: normalized-order-events
   */
  private async startTransformPipeline(): Promise<void> {
    const processor = new KafkaStreamProcessor(this.kafka);
    this.processors.push(processor);

    processor
      .from('order-events')
      .withGroupId('stream-transform')
      .transform(async (msg) => {
        if (!msg.value) return null;
        const event = JSON.parse(msg.value.toString());
        return {
          key: msg.key,
          value: JSON.stringify({
            eventId: `${event.orderId}-${event.type}-${Date.now()}`,
            orderId: event.orderId,
            eventType: event.type,
            payload: event.payload ?? {},
            timestamp: event.timestamp ?? new Date().toISOString(),
            schemaVersion: '1.0',
          }),
          headers: { ...msg.headers, 'x-pipeline': 'transform' },
        };
      })
      .to('normalized-order-events');

    await processor.start();
    logger.info('Transform pipeline started: order-events -> normalized-order-events');
  }
}
