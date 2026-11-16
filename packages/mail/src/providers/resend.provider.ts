import { createHmac, timingSafeEqual } from 'crypto';
import type { ResendProviderOptions } from '../types/module.types';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailLifecycleEvent } from '../types/webhook.types';
import type { MailProvider } from './provider.interface';

export const RESEND_PROVIDER_NAME = 'resend';

/** Resend HTTP API provider (fetch-based, no SDK required). */
export class ResendMailProvider implements MailProvider {
  readonly name = RESEND_PROVIDER_NAME;

  constructor(private readonly options: ResendProviderOptions) {}

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    const baseUrl = this.options.baseUrl ?? 'https://api.resend.com';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (message.idempotencyKey) {
      headers['Idempotency-Key'] = message.idempotencyKey;
    }

    const body = {
      from: message.from || this.options.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      tags: message.tags
        ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
        : undefined,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content:
          typeof a.content === 'string' ? a.content : Buffer.from(a.content).toString('base64'),
      })),
    };

    const response = await fetch(`${baseUrl}/emails`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        `Resend send failed (${response.status}): ${JSON.stringify(raw)}`
      ) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    return {
      messageId: String((raw as { id?: string }).id ?? message.idempotencyKey ?? ''),
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

  parseWebhookEvent(payload: string | Buffer, headers: Record<string, string>): MailLifecycleEvent {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    if (this.options.webhookSecret) {
      this.verifySignature(text, headers);
    }
    const body = JSON.parse(text) as {
      type?: string;
      data?: {
        email_id?: string;
        to?: string[] | string;
        created_at?: string;
        click?: { link?: string };
      };
    };

    const typeRaw = String(body.type ?? 'unknown').toLowerCase();
    let type: MailLifecycleEvent['type'] = 'unknown';
    if (typeRaw.includes('bounced') || typeRaw.includes('bounce')) type = 'bounce';
    else if (typeRaw.includes('complained') || typeRaw.includes('complaint')) type = 'complaint';
    else if (typeRaw.includes('delivered') || typeRaw.includes('delivery')) type = 'delivery';
    else if (typeRaw.includes('opened') || typeRaw.includes('open')) type = 'open';
    else if (typeRaw.includes('clicked') || typeRaw.includes('click')) type = 'click';

    const to = body.data?.to;
    const recipient = Array.isArray(to) ? to[0] : to;

    return {
      type,
      provider: this.name,
      messageId: body.data?.email_id,
      recipient,
      timestamp: body.data?.created_at,
      url: body.data?.click?.link,
      raw: body,
    };
  }

  private verifySignature(payload: string, headers: Record<string, string>): void {
    const secret = this.options.webhookSecret!;
    const signature =
      headers['resend-signature'] ??
      headers['svix-signature'] ??
      headers['webhook-signature'] ??
      '';
    const timestamp = headers['resend-timestamp'] ?? headers['svix-timestamp'] ?? '';
    if (!signature) {
      throw new Error('Missing Resend webhook signature');
    }
    // Support simple HMAC of payload or svix-style v1,<hex>
    const signed = createHmac('sha256', secret)
      .update(timestamp ? `${timestamp}.${payload}` : payload)
      .digest('hex');
    const provided = signature.includes(',')
      ? signature.split(',').map((p) => p.replace(/^v1=/, '').trim())
      : [signature.replace(/^v1=/, '').trim()];
    const ok = provided.some((sig) => {
      try {
        const a = Buffer.from(sig);
        const b = Buffer.from(signed);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
    if (!ok) {
      throw new Error('Invalid Resend webhook signature');
    }
  }
}
