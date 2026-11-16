import { randomUUID } from 'crypto';
import { Service } from '@hazeljs/core';
import type { BrandTheme } from './compose/brand';
import { DEFAULT_BRAND } from './compose/brand';
import type { MailableClass } from './compose/mailables';
import { MailCatalog, globalMailCatalog } from './compose/mailables';
import {
  MAIL_DEFERRED,
  MAIL_FAILED,
  MAIL_INTERCEPTED,
  MAIL_QUEUED,
  MAIL_SENT,
  MAIL_SUPPRESSED,
  lifecycleEventName,
} from './events/mail.events';
import { DeliveryPolicy } from './policy/delivery-policy';
import type { MailProvider } from './providers/provider.interface';
import { HandlebarsAdapter } from './render/handlebars.adapter';
import { formatAddress, formatAddresses } from './render/address';
import { renderHtml } from './render/html.renderer';
import { renderIcs } from './render/ics';
import { htmlToText, renderText } from './render/text.renderer';
import { sendWithFailover } from './reliability/failover';
import { resolveRetry } from './reliability/retry';
import { enqueueMail, type MailQueueClient } from './queue/mail.queue';
import type { EmailDocument, MailAttachment, NormalizedMailMessage } from './types/email-document';
import type { ResolvedMailModuleOptions } from './types/module.types';
import type { SendMailableOptions, SendResult, SendTemplateOptions } from './types/send.types';
import type { MailLifecycleEvent } from './types/webhook.types';

export interface MailServiceRuntime {
  options: ResolvedMailModuleOptions;
  policy: DeliveryPolicy;
  templateAdapter?: HandlebarsAdapter;
  catalog: MailCatalog;
  queue?: MailQueueClient;
}

@Service()
export class MailService {
  private static runtime: MailServiceRuntime | null = null;

  private readonly options: ResolvedMailModuleOptions;
  private readonly policy: DeliveryPolicy;
  private readonly templateAdapter?: HandlebarsAdapter;
  private readonly catalog: MailCatalog;
  private readonly queue?: MailQueueClient;

  constructor() {
    const runtime = MailService.getRuntime();
    this.options = runtime.options;
    this.policy = runtime.policy;
    this.templateAdapter = runtime.templateAdapter;
    this.catalog = runtime.catalog;
    this.queue = runtime.queue;
  }

  static configure(runtime: MailServiceRuntime): void {
    MailService.runtime = runtime;
  }

  static getRuntime(): MailServiceRuntime {
    if (!MailService.runtime) {
      throw new Error(
        'MailModule not configured. Call MailModule.forRoot({ ... }) in your app module.'
      );
    }
    return MailService.runtime;
  }

  /** Reset static config (tests). */
  static reset(): void {
    MailService.runtime = null;
  }

  getCatalog(): MailCatalog {
    return this.catalog;
  }

  getProvider<T extends MailProvider = MailProvider>(name: string): T {
    const provider = this.options.providers[name];
    if (!provider) {
      throw new Error(
        `Mail provider "${name}" not found. Registered: ${Object.keys(this.options.providers).join(', ')}`
      );
    }
    return provider as T;
  }

  getProviderNames(): string[] {
    return Object.keys(this.options.providers);
  }

  async send(doc: EmailDocument): Promise<SendResult> {
    try {
      const decision = await this.policy.evaluate(doc);
      if (decision.action === 'suppress') {
        const result: SendResult = {
          messageId: doc.idempotencyKey ?? `suppressed-${randomUUID()}`,
          provider: 'policy',
          status: 'suppressed',
          reason: decision.reason,
          correlationId: doc.correlationId,
        };
        this.emit(MAIL_SUPPRESSED, { document: doc, result });
        return result;
      }

      if (decision.action === 'defer') {
        const result: SendResult = {
          messageId: doc.idempotencyKey ?? `deferred-${randomUUID()}`,
          provider: 'policy',
          status: 'deferred',
          reason: decision.reason,
          correlationId: doc.correlationId,
        };
        this.emit(MAIL_DEFERRED, { document: doc, result, retryAfterMs: decision.retryAfterMs });
        return result;
      }

      let working: EmailDocument = { ...doc, to: decision.recipients };
      if (decision.action === 'intercept') {
        working = {
          ...working,
          to: decision.recipients,
          subject: `${decision.subjectPrefix ?? '[INTERCEPTED] '}${doc.subject}`,
          headers: {
            ...(doc.headers ?? {}),
            'X-Hazel-Intercepted-To': decision.originalRecipients.join(', '),
          },
        };
      }

      const message = this.normalize(working);
      const providerName =
        working.provider ?? this.options.defaultProvider ?? Object.keys(this.options.providers)[0];
      if (!providerName) {
        throw new Error('No mail providers registered');
      }

      const providerResult = await sendWithFailover(
        this.options.providers,
        providerName,
        this.options.failover,
        message,
        resolveRetry(this.options.retry)
      );

      const result: SendResult = {
        ...providerResult,
        status: decision.action === 'intercept' ? 'intercepted' : 'sent',
        correlationId: message.correlationId,
        reason: decision.action === 'intercept' ? 'Recipients intercepted' : undefined,
      };

      this.emit(decision.action === 'intercept' ? MAIL_INTERCEPTED : MAIL_SENT, {
        document: working,
        message,
        result,
      });
      return result;
    } catch (error) {
      this.emit(MAIL_FAILED, { document: doc, error });
      throw error;
    }
  }

  async sendLater(doc: EmailDocument): Promise<SendResult> {
    if (!this.queue || !this.options.queue.enabled) {
      return this.send(doc);
    }
    const job = await enqueueMail(this.queue, this.options.queue.name, this.options.queue.jobName, {
      document: doc,
    });
    const result: SendResult = {
      messageId: job.id ?? doc.idempotencyKey ?? `queued-${randomUUID()}`,
      provider: 'queue',
      status: 'queued',
      correlationId: doc.correlationId,
    };
    this.emit(MAIL_QUEUED, { document: doc, result });
    return result;
  }

  async sendTemplate(name: string, options: SendTemplateOptions): Promise<SendResult> {
    if (!this.templateAdapter) {
      throw new Error(
        'Template engine not configured. Pass template: { dir } to MailModule.forRoot().'
      );
    }
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const doc = this.templateAdapter.toDocument(name, {
      to,
      context: options.context,
      subject: options.subject,
      category: options.category,
      from: options.from,
      locale: options.locale,
      tags: options.tags,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      idempotencyKey: options.idempotencyKey,
      correlationId: options.correlationId,
      provider: options.provider,
    });
    return this.send(doc);
  }

  async sendMailable<T>(
    mailable: MailableClass<T> | string,
    options: SendMailableOptions<T>
  ): Promise<SendResult> {
    const resolved = typeof mailable === 'string' ? this.catalog.get<T>(mailable) : mailable;
    if (!resolved) {
      throw new Error(`Unknown mailable: ${String(mailable)}`);
    }
    const rendered = resolved.render(options.data);
    const doc: EmailDocument = {
      ...rendered,
      to: Array.isArray(options.to) ? options.to : [options.to],
      provider: options.provider ?? rendered.provider,
      idempotencyKey: options.idempotencyKey ?? rendered.idempotencyKey,
      correlationId: options.correlationId ?? rendered.correlationId,
      locale: options.locale ?? rendered.locale,
    };
    return this.send(doc);
  }

  normalize(doc: EmailDocument): NormalizedMailMessage {
    const brand = this.resolveBrand(doc.brand);
    const html = renderHtml(doc, brand);
    const text = doc.text ?? renderText(doc, brand) ?? htmlToText(html);
    const from = doc.from
      ? formatAddress(doc.from)
      : (this.options.defaults.from ?? brand.supportEmail ?? 'noreply@localhost');

    const headers: Record<string, string> = { ...(doc.headers ?? {}) };
    if (doc.unsubscribe) {
      const parts = [`<${doc.unsubscribe.url}>`];
      if (doc.unsubscribe.oneClickUrl) {
        parts.push(`<${doc.unsubscribe.oneClickUrl}>`);
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }
      headers['List-Unsubscribe'] = parts.join(', ');
    }
    if (doc.correlationId) {
      headers['X-Correlation-Id'] = doc.correlationId;
    }
    headers['X-Hazel-Mail-Category'] = doc.category;

    const attachments: MailAttachment[] = [...(doc.attachments ?? [])];
    const metadata: Record<string, unknown> = { ...(doc.metadata ?? {}) };
    if (doc.ics) {
      const icsContent = renderIcs(doc.ics);
      metadata.icsContent = icsContent;
      attachments.push({
        filename: 'invite.ics',
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST',
      });
    }

    return {
      to: formatAddresses(doc.to),
      cc: formatAddresses(doc.cc),
      bcc: formatAddresses(doc.bcc),
      from,
      replyTo: doc.replyTo ? formatAddress(doc.replyTo) : this.options.defaults.replyTo,
      subject: doc.subject,
      html,
      text,
      attachments: attachments.length ? attachments : undefined,
      headers,
      tags: doc.tags,
      metadata,
      category: doc.category,
      idempotencyKey: doc.idempotencyKey,
      correlationId: doc.correlationId ?? randomUUID(),
      provider: doc.provider,
    };
  }

  parseWebhookEvent(
    providerName: string,
    payload: string | Buffer,
    headers: Record<string, string>
  ): MailLifecycleEvent | MailLifecycleEvent[] {
    const provider = this.getProvider(providerName);
    if (!provider.parseWebhookEvent) {
      throw new Error(`Provider "${providerName}" does not support webhooks`);
    }
    const events = provider.parseWebhookEvent(payload, headers);
    const list = Array.isArray(events) ? events : [events];
    for (const event of list) {
      this.emit(lifecycleEventName(event.type), event);
    }
    return events;
  }

  private resolveBrand(key?: string): BrandTheme {
    if (key && this.options.brands[key]) {
      return this.options.brands[key];
    }
    return this.options.brands.default ?? DEFAULT_BRAND;
  }

  private emit(event: string, payload: unknown): void {
    this.options.eventEmitter?.emit(event, payload);
  }
}

export { globalMailCatalog };
