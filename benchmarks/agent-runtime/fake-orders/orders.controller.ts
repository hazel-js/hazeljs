import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  Res,
  type Response,
} from '@hazeljs/core';
import { OrdersService, parseTenant } from './orders.service';

/** Public order/refund API (external system under test). */
@Controller('/')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('/orders/:orderId')
  getOrder(@Headers('authorization') authorization: string, @Param('orderId') orderId: string) {
    const tenantId = parseTenant(authorization);
    return this.orders.getOrder(tenantId, decodeURIComponent(orderId));
  }

  @Get('/refunds/by-key/:key')
  getRefundByKey(@Headers('authorization') authorization: string, @Param('key') key: string) {
    const tenantId = parseTenant(authorization);
    return this.orders.getRefundByKey(tenantId, decodeURIComponent(key));
  }

  @Post('/refunds')
  async createRefund(
    @Headers('authorization') authorization: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: Record<string, unknown>,
    @Res() res: Response
  ) {
    const tenantId = parseTenant(authorization);
    const result = await this.orders.createRefund(tenantId, body ?? {}, idempotencyKey);
    res.status(result.status).json(result.body);
  }
}

/** Test-only control surface for seeding / barriers / stats. */
@Controller('/_test')
export class OrdersTestController {
  constructor(private readonly orders: OrdersService) {}

  @Get('/health')
  health() {
    return { ok: true };
  }

  @Get('/stats')
  stats(@Headers('authorization') authorization: string) {
    parseTenant(authorization);
    return this.orders.stats();
  }

  @Post('/configure')
  @HttpCode(200)
  configure(
    @Headers('authorization') authorization: string,
    @Body() body: Record<string, unknown>
  ) {
    parseTenant(authorization);
    this.orders.configure(body ?? {});
    return { ok: true };
  }

  @Post('/release')
  @HttpCode(200)
  release(@Headers('authorization') authorization: string) {
    parseTenant(authorization);
    this.orders.release();
    return { ok: true };
  }

  @Post('/seed')
  @HttpCode(201)
  seed(@Headers('authorization') authorization: string, @Body() body: Record<string, unknown>) {
    const tenantId = parseTenant(authorization);
    this.orders.seed(tenantId, body ?? {});
    return { ok: true };
  }
}
