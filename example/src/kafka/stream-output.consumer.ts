import { Injectable } from '@hazeljs/core';
import { KafkaConsumer, KafkaSubscribe, KafkaMessagePayload } from '@hazeljs/kafka';
import logger from '@hazeljs/core';

/**
 * Consumes from stream pipeline output topics.
 * Demonstrates the full flow: produce -> stream -> consume
 */
@KafkaConsumer({ groupId: 'stream-output-reader' })
@Injectable()
export class StreamOutputConsumer {
  @KafkaSubscribe('enriched-orders')
  async handleEnrichedOrder({ message }: KafkaMessagePayload) {
    if (!message.value) return;
    const order = JSON.parse(message.value.toString());
    logger.info(`[Stream] Enriched order: ${order.id} (items: ${order.orderCount})`);
  }

  @KafkaSubscribe('high-value-orders')
  async handleHighValueOrder({ message }: KafkaMessagePayload) {
    if (!message.value) return;
    const order = JSON.parse(message.value.toString());
    logger.info(`[Stream] High-value order: ${order.id} total=$${order.total}`);
  }

  @KafkaSubscribe('normalized-order-events')
  async handleNormalizedEvent({ message }: KafkaMessagePayload) {
    if (!message.value) return;
    const event = JSON.parse(message.value.toString());
    logger.info(`[Stream] Normalized event: ${event.eventType} for order ${event.orderId}`);
  }
}
