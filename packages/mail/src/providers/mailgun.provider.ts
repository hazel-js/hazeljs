import { createHmac, timingSafeEqual } from 'crypto';
import type { MailgunProviderOptions } from '../types/module.types';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailLifecycleEvent } from '../types/webhook.types';
import type { MailProvider } from './provider.interface';
import { extractEmail } from '../render/address';

export const MAILGUN_PROVIDER_NAME = 'mailgun';

/** Mailgun Messages API (fetch-based, no SDK required). */
export class MailgunMailProvider implements MailProvider {
  readonly name = MAILGUN_PROVIDER_NAME;

  constructor(private readonly options: MailgunProviderOptions) {}

  private apiHost(): string {
    if (this.options.baseUrl) {
      return this.options.baseUrl.replace(/\/$/, '');
    }
    return this.options.region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
  }

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    const from = message.from || this.options.from;
    if (!from) {
      throw new Error('Mailgun requires a from address');
    }

    const form = new URLSearchParams();
    form.set('from', from);
    for (const to of message.to) {
      form.append('to', to);
    }
    for (const cc of message.cc ?? []) {
      form.append('cc', cc);
    }
    for (const bcc of message.bcc ?? []) {
      form.append('bcc', bcc);
    }
    if (message.replyTo) {
      form.set('h:Reply-To', message.replyTo);
    }
    form.set('subject', message.subject);
    form.set('html', message.html);
    form.set('text', message.text);

    for (const [key, value] of Object.entries(message.headers)) {
      form.set(`h:${key}`, value);
    }
    if (message.tags) {
      for (const [key, value] of Object.entries(message.tags)) {
        form.set(`v:${key}`, value);
      }
      form.append('o:tag', Object.values(message.tags).join(','));
    }
    if (message.idempotencyKey) {
      form.set('v:idempotency-key', message.idempotencyKey);
    }

    // Simple attachments as inline base64 via Mailgun's attachment format is multipart;
    // for binary attachments prefer SMTP or multipart client. Text/base64 note in metadata.
    if (message.attachments?.length) {
      form.set('v:hazel-attachments', String(message.attachments.length));
    }

    const auth = Buffer.from(`api:${this.options.apiKey}`).toString('base64');
    const url = `${this.apiHost()}/v3/${this.options.domain}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        `Mailgun send failed (${response.status}): ${JSON.stringify(raw)}`
      ) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    return {
      messageId: String(
        (raw as { id?: string }).id ?? message.idempotencyKey ?? `mailgun-${Date.now()}`
      ),
      provider: this.name,
      accepted: message.to,
      raw,
    };
  }

  async health(): Promise<'up' | 'down'> {
    return this.options.apiKey && this.options.domain ? 'up' : 'down';
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.options.webhookSigningKey ?? this.options.webhookSecret);
  }

  parseWebhookEvent(payload: string | Buffer, headers: Record<string, string>): MailLifecycleEvent {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    const body = this.parseBody(text);

    const signingKey = this.options.webhookSigningKey ?? this.options.webhookSecret;
    if (signingKey) {
      this.verifySignature(body, signingKey, headers);
    }

    const eventData = (
      typeof body['event-data'] === 'object' && body['event-data'] ? body['event-data'] : body
    ) as Record<string, unknown>;
    const eventName = String(eventData.event ?? body.event ?? 'unknown').toLowerCase();

    let type: MailLifecycleEvent['type'] = 'unknown';
    if (eventName.includes('bounc') || eventName.includes('failed')) type = 'bounce';
    else if (eventName.includes('complain')) type = 'complaint';
    else if (eventName.includes('deliver')) type = 'delivery';
    else if (eventName.includes('open')) type = 'open';
    else if (eventName.includes('click')) type = 'click';
    else if (eventName.includes('reject')) type = 'reject';

    const message = (eventData.message ?? {}) as {
      headers?: Record<string, string>;
    };
    const recipient =
      (eventData.recipient as string | undefined) ?? (body.recipient as string | undefined);

    return {
      type,
      provider: this.name,
      messageId:
        (eventData['message-id'] as string | undefined) ??
        message.headers?.['message-id'] ??
        (body['Message-Id'] as string | undefined),
      recipient: recipient ? extractEmail(recipient) : undefined,
      timestamp:
        typeof eventData.timestamp === 'number'
          ? new Date(eventData.timestamp * 1000).toISOString()
          : (body.timestamp as string | undefined),
      reason:
        typeof eventData['delivery-status'] === 'object' && eventData['delivery-status']
          ? String(
              (eventData['delivery-status'] as { message?: string }).message ??
                (eventData.reason as string | undefined) ??
                ''
            ) || undefined
          : (eventData.reason as string | undefined),
      url: (eventData.url as string | undefined) ?? (body.url as string | undefined),
      raw: body,
    };
  }

  private parseBody(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const params = new URLSearchParams(text);
      const out: Record<string, unknown> = {};
      for (const [key, value] of params.entries()) {
        out[key] = value;
      }
      return out;
    }
  }

  private verifySignature(
    body: Record<string, unknown>,
    signingKey: string,
    headers: Record<string, string>
  ): void {
    const timestamp = String(
      body.timestamp ??
        (body.signature as { timestamp?: string } | undefined)?.timestamp ??
        headers['x-mailgun-timestamp'] ??
        ''
    );
    const token = String(
      body.token ??
        (body.signature as { token?: string } | undefined)?.token ??
        headers['x-mailgun-token'] ??
        ''
    );
    const signature = String(
      body.signature && typeof body.signature === 'string'
        ? body.signature
        : ((body.signature as { signature?: string } | undefined)?.signature ??
            headers['x-mailgun-signature'] ??
            headers['x-mailgun-signature-256'] ??
            '')
    );

    // Nested Mailgun v3 webhook shape: { signature: { timestamp, token, signature } }
    const nested = body.signature;
    const finalTimestamp =
      timestamp ||
      (typeof nested === 'object' && nested
        ? String((nested as { timestamp?: string }).timestamp ?? '')
        : '');
    const finalToken =
      token ||
      (typeof nested === 'object' && nested
        ? String((nested as { token?: string }).token ?? '')
        : '');
    const finalSignature =
      signature ||
      (typeof nested === 'object' && nested
        ? String((nested as { signature?: string }).signature ?? '')
        : '');

    if (!finalTimestamp || !finalToken || !finalSignature) {
      throw new Error('Missing Mailgun webhook signature fields');
    }

    const encoded = createHmac('sha256', signingKey)
      .update(finalTimestamp.concat(finalToken))
      .digest('hex');
    const a = Buffer.from(finalSignature);
    const b = Buffer.from(encoded);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid Mailgun webhook signature');
    }
  }
}
