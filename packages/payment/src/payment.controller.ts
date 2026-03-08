/**
 * Optional controller for checkout session creation and provider webhooks.
 * Webhooks require raw body for signature verification.
 */

import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  Res,
  type Request,
  type Response,
} from '@hazeljs/core';
import { PaymentService } from './payment.service';
import type { CreateCheckoutSessionOptions } from './types/payment.types';

interface CheckoutSessionBody extends CreateCheckoutSessionOptions {
  /** Provider to use (e.g. 'stripe'). Defaults to module defaultProvider. */
  provider?: string;
}

@Controller('/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /payment/checkout-session
   * Create a checkout session. Body may include provider to choose provider (e.g. { provider: 'stripe' }).
   * Returns { sessionId, url }. Redirect the user to url.
   */
  @Post('/checkout-session')
  async createCheckoutSession(
    @Body() body: CheckoutSessionBody,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { provider, ...options } = body;
      const result = await this.paymentService.createCheckoutSession(options, provider);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create checkout session';
      res.status(400).json({ error: message });
    }
  }

  /**
   * POST /payment/webhook/:provider
   * Webhook endpoint for a given provider (e.g. /payment/webhook/stripe).
   * Requires raw request body; provider's signature header must be forwarded (e.g. Stripe-Signature).
   */
  @Post('/webhook/:provider')
  async webhook(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const sig =
      (req.headers && (req.headers['stripe-signature'] as string)) ??
      (req.headers && (req.headers['paypal-transmission-sig'] as string)) ??
      '';
    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody ??
      (typeof (req as Request & { body?: unknown }).body === 'string'
        ? (req as Request & { body: string }).body
        : Buffer.isBuffer((req as Request & { body?: Buffer }).body)
          ? (req as Request & { body: Buffer }).body
          : null);

    if (!rawBody) {
      res.status(400).send('Webhook requires raw body');
      return;
    }

    try {
      const event = this.paymentService.parseWebhookEvent(provider, rawBody, sig);
      res.status(200).json({
        received: true,
        provider,
        type:
          typeof event === 'object' && event !== null && 'type' in event
            ? (event as { type: string }).type
            : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
      res.status(400).send(message);
    }
  }
}
