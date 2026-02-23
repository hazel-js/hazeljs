import { Controller, Post, Body } from '@hazeljs/core';
import { OrderService } from './order.service';

/**
 * Example controller that produces Kafka messages via OrderService
 */
@Controller('/kafka/orders')
export class KafkaExampleController {
  constructor(private orderService: OrderService) {}

  @Post('/')
  async createOrder(
    @Body()
    body: { id: string; userId: string; items: string[]; total: number }
  ) {
    return this.orderService.createOrder(body);
  }

  @Post('/events')
  async publishEvent(
    @Body()
    body: { orderId: string; eventType: string; payload?: object }
  ) {
    await this.orderService.publishOrderEvent(
      body.orderId,
      body.eventType,
      body.payload ?? {}
    );
    return { published: true };
  }
}
