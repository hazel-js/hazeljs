import { Injectable } from '@hazeljs/core';
import { KafkaConsumer, KafkaSubscribe, KafkaMessagePayload } from '@hazeljs/kafka';
import logger from '@hazeljs/core';

/**
 * Example Kafka consumer for order events
 */
@KafkaConsumer({ groupId: 'order-processor' })
@Injectable()
export class OrderConsumer {
  @KafkaSubscribe('orders')
  async handleOrder({ message }: KafkaMessagePayload) {
    if (!message.value) return;
    const order = JSON.parse(message.value.toString());
    logger.info(`Processing order: ${order.id}`, order);
  }

  @KafkaSubscribe('order-events', { fromBeginning: false })
  async handleOrderEvents({ message }: KafkaMessagePayload) {
    if (!message.value) return;
    const event = JSON.parse(message.value.toString());
    logger.debug(`Order event: ${event.type}`, event);
  }
}
