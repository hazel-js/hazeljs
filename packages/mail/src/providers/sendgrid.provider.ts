import { createHmac, timingSafeEqual } from 'crypto';
import type { SendGridProviderOptions } from '../types/module.types';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailLifecycleEvent } from '../types/webhook.types';
import type { MailProvider } from './provider.interface';
import { extractEmail } from '../render/address';

export const SENDGRID_PROVIDER_NAME = 'sendgrid';

function splitAddress(value: string): { email: string; name?: string } {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
  }
  return { email: value.trim() };
}

/** SendGrid v3 Mail Send API (fetch-based, no SDK required). */
export class SendGridMailProvider implements MailProvider {
  readonly name = SENDGRID_PROVIDER_NAME;

  constructor(private readonly options: SendGridProviderOptions) {}

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    const baseUrl = this.options.baseUrl ?? 'https://api.sendgrid.com';
    const from = splitAddress(message.from || this.options.from || '');
    if (!from.email) {
      throw new Error('SendGrid requires a from address');
    }

    const body = {
      personalizations: [
        {
          to: message.to.map((addr) => splitAddress(addr)),
          cc: message.cc?.map((addr) => splitAddress(addr)),
          bcc: message.bcc?.map((addr) => splitAddress(addr)),
          custom_args: message.tags,
        },
      ],
      from,
      reply_to: message.replyTo ? splitAddress(message.replyTo) : undefined,
      subject: message.subject,
      content: [
        { type: 'text/plain', value: message.text || ' ' },
        { type: 'text/html', value: message.html || message.text || ' ' },
      ],
      headers: message.headers,
      categories: message.tags ? Object.values(message.tags) : undefined,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        type: a.contentType,
        disposition: a.contentDisposition ?? 'attachment',
        content_id: a.cid,
        content:
          typeof a.content === 'string'
            ? Buffer.from(a.content).toString('base64')
            : Buffer.from(a.content).toString('base64'),
      })),
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (message.idempotencyKey) {
      // SendGrid does not document Idempotency-Key; keep as custom header for tracing.
      headers['X-Hazel-Idempotency-Key'] = message.idempotencyKey;
    }

    const response = await fetch(`${baseUrl}/v3/mail/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let raw: unknown = {};
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch {
      raw = { body: rawText };
    }

    if (!response.ok) {
      const err = new Error(
        `SendGrid send failed (${response.status}): ${rawText || JSON.stringify(raw)}`
      ) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    const messageId =
      response.headers.get('x-message-id') ?? message.idempotencyKey ?? `sendgrid-${Date.now()}`;

    return {
      messageId,
      provider: this.name,
      accepted: message.to,
      raw,
    };
  }

  async health(): Promise<'up' | 'down'> {
    return this.options.apiKey ? 'up' : 'down';
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.options.webhookSecret);
  }

  parseWebhookEvent(
    payload: string | Buffer,
    headers: Record<string, string>
  ): MailLifecycleEvent | MailLifecycleEvent[] {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    if (this.options.webhookSecret) {
      this.verifySignature(text, headers);
    }

    const parsed = JSON.parse(text) as Array<Record<string, unknown>> | Record<string, unknown>;
    const events = Array.isArray(parsed) ? parsed : [parsed];

    return events.map((event) => {
      const eventName = String(event.event ?? event.type ?? 'unknown').toLowerCase();
      let type: MailLifecycleEvent['type'] = 'unknown';
      if (eventName.includes('bounce') || eventName === 'dropped') type = 'bounce';
      else if (eventName.includes('spam') || eventName.includes('complaint')) type = 'complaint';
      else if (eventName.includes('deliver')) type = 'delivery';
      else if (eventName.includes('open')) type = 'open';
      else if (eventName.includes('click')) type = 'click';
      else if (eventName.includes('defer') || eventName.includes('reject')) type = 'reject';

      return {
        type,
        provider: this.name,
        messageId: String(event.sg_message_id ?? event['smtp-id'] ?? event.message_id ?? ''),
        recipient: event.email ? extractEmail(String(event.email)) : undefined,
        timestamp: event.timestamp
          ? new Date(Number(event.timestamp) * 1000).toISOString()
          : undefined,
        reason: event.reason ? String(event.reason) : undefined,
        url: event.url ? String(event.url) : undefined,
        raw: event,
      };
    });
  }

  private verifySignature(payload: string, headers: Record<string, string>): void {
    // Optional HMAC verification for custom/proxy setups.
    // Official SendGrid Event Webhook uses ECDSA; pass webhookSecret only when using HMAC.
    const signature =
      headers['x-twilio-email-event-webhook-signature'] ??
      headers['x-sendgrid-signature'] ??
      headers['webhook-signature'] ??
      '';
    const timestamp =
      headers['x-twilio-email-event-webhook-timestamp'] ?? headers['x-sendgrid-timestamp'] ?? '';
    if (!signature) {
      throw new Error('Missing SendGrid webhook signature');
    }
    const signed = createHmac('sha256', this.options.webhookSecret!)
      .update(timestamp ? `${timestamp}${payload}` : payload)
      .digest('base64');
    const a = Buffer.from(signature);
    const b = Buffer.from(signed);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid SendGrid webhook signature');
    }
  }
}
