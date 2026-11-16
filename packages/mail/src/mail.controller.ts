import { Controller, Post, Param, Req, Res, type Request, type Response } from '@hazeljs/core';
import { MailService } from './mail.service';

@Controller('/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * POST /mail/webhook/:provider
   * Lifecycle webhooks (bounce, complaint, delivery, open, click).
   * Prefer raw body for signature verification.
   */
  @Post('/webhook/:provider')
  async webhook(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers ?? {})) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      } else if (Array.isArray(value) && value[0]) {
        headers[key.toLowerCase()] = value[0];
      }
    }

    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody ??
      (typeof (req as Request & { body?: unknown }).body === 'string'
        ? (req as Request & { body: string }).body
        : Buffer.isBuffer((req as Request & { body?: Buffer }).body)
          ? (req as Request & { body: Buffer }).body
          : typeof (req as Request & { body?: unknown }).body === 'object' &&
              (req as Request & { body?: unknown }).body != null
            ? JSON.stringify((req as Request & { body: unknown }).body)
            : null);

    if (!rawBody) {
      res.status(400).json({ error: 'Webhook requires raw body' });
      return;
    }

    try {
      const event = this.mailService.parseWebhookEvent(provider, rawBody, headers);
      res.status(200).json({
        received: true,
        provider,
        event,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      res.status(400).json({ error: message });
    }
  }
}
