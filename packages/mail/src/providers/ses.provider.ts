import { createHmac, createHash } from 'crypto';
import type { SesProviderOptions } from '../types/module.types';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailLifecycleEvent } from '../types/webhook.types';
import type { MailProvider } from './provider.interface';

export const SES_PROVIDER_NAME = 'ses';

/**
 * Amazon SES provider using SigV4-signed fetch (no AWS SDK required).
 */
export class SesMailProvider implements MailProvider {
  readonly name = SES_PROVIDER_NAME;

  constructor(private readonly options: SesProviderOptions) {}

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    const region = this.options.region;
    const host = this.options.endpoint
      ? new URL(this.options.endpoint).host
      : `email.${region}.amazonaws.com`;
    const endpoint = this.options.endpoint ?? `https://${host}/v2/email/outbound-emails`;

    const body = JSON.stringify({
      FromEmailAddress: message.from || this.options.from,
      Destination: {
        ToAddresses: message.to,
        CcAddresses: message.cc,
        BccAddresses: message.bcc,
      },
      ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: message.html, Charset: 'UTF-8' },
            Text: { Data: message.text, Charset: 'UTF-8' },
          },
        },
      },
      ConfigurationSetName: this.options.configurationSetName,
      EmailTags: message.tags
        ? Object.entries(message.tags).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    });

    const headers = await this.sign('POST', host, '/v2/email/outbound-emails', body, region);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      body,
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        `SES send failed (${response.status}): ${JSON.stringify(raw)}`
      ) as Error & { status: number };
      err.status = response.status;
      throw err;
    }

    return {
      messageId: String((raw as { MessageId?: string }).MessageId ?? message.idempotencyKey ?? ''),
      provider: this.name,
      accepted: message.to,
      raw,
    };
  }

  async health(): Promise<'up' | 'down'> {
    return this.options.region ? 'up' : 'down';
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.options.webhookSecret);
  }

  parseWebhookEvent(
    payload: string | Buffer,
    _headers: Record<string, string>
  ): MailLifecycleEvent | MailLifecycleEvent[] {
    const text = typeof payload === 'string' ? payload : payload.toString('utf8');
    const body = JSON.parse(text) as Record<string, unknown>;

    // SNS envelope
    const message =
      typeof body.Message === 'string'
        ? (JSON.parse(body.Message) as Record<string, unknown>)
        : body;

    const notificationType = String(
      message.notificationType ?? message.eventType ?? 'unknown'
    ).toLowerCase();
    const mail = (message.mail ?? {}) as { messageId?: string };
    const bounce = message.bounce as
      { bouncedRecipients?: Array<{ emailAddress?: string; diagnosticCode?: string }> } | undefined;
    const complaint = message.complaint as
      { complainedRecipients?: Array<{ emailAddress?: string }> } | undefined;
    const delivery = message.delivery as { recipients?: string[]; timestamp?: string } | undefined;

    if (notificationType.includes('bounce')) {
      return (bounce?.bouncedRecipients ?? [{ emailAddress: undefined }]).map((r) => ({
        type: 'bounce' as const,
        provider: this.name,
        messageId: mail.messageId,
        recipient: r.emailAddress,
        reason: r.diagnosticCode,
        raw: message,
      }));
    }
    if (notificationType.includes('complaint')) {
      return (complaint?.complainedRecipients ?? [{ emailAddress: undefined }]).map((r) => ({
        type: 'complaint' as const,
        provider: this.name,
        messageId: mail.messageId,
        recipient: r.emailAddress,
        raw: message,
      }));
    }
    if (notificationType.includes('delivery')) {
      return {
        type: 'delivery',
        provider: this.name,
        messageId: mail.messageId,
        recipient: delivery?.recipients?.[0],
        timestamp: delivery?.timestamp,
        raw: message,
      };
    }
    return {
      type: 'unknown',
      provider: this.name,
      messageId: mail.messageId,
      raw: message,
    };
  }

  private async sign(
    method: string,
    host: string,
    path: string,
    body: string,
    region: string
  ): Promise<Record<string, string>> {
    const accessKeyId = this.options.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = this.options.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = this.options.sessionToken ?? process.env.AWS_SESSION_TOKEN;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('SES credentials missing (accessKeyId/secretAccessKey or AWS env vars)');
    }

    const service = 'ses';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(body);
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join(
      '\n'
    );

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = hmac(signingKey, stringToSign).toString('hex');

    const headers: Record<string, string> = {
      host,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
    if (sessionToken) {
      headers['x-amz-security-token'] = sessionToken;
    }
    return headers;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${key}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
