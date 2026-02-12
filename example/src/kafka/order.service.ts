import { Injectable } from '@hazeljs/core';
import { KafkaProducerService } from '@hazeljs/kafka';

export interface CreateOrderDto {
  id: string;
  userId: string;
  items: string[];
  total: number;
}

/**
 * Example order service that produces Kafka messages
 */
@Injectable()
export class OrderService {
  constructor(private producer: KafkaProducerService) {}

  async createOrder(data: CreateOrderDto) {
    await this.producer.send('orders', [
      {
        key: data.id,
        value: JSON.stringify({
          ...data,
          createdAt: new Date().toISOString(),
        }),
      },
    ]);
    return data;
  }

  async publishOrderEvent(orderId: string, eventType: string, payload: object) {
    await this.producer.send('order-events', [
      {
        key: orderId,
        value: JSON.stringify({
          orderId,
          type: eventType,
          payload,
          timestamp: new Date().toISOString(),
        }),
      },
    ]);
  }
}
