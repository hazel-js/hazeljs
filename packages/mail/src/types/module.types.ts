import type { BrandTheme } from '../compose/brand';
import type { MailProvider } from '../providers/provider.interface';
import type { MailQueueClient } from '../queue/mail.queue';
import type { DeliveryPolicyOptions } from './policy.types';
import type { RetryOptions } from './send.types';

export interface SmtpProviderOptions {
  host: string;
  port?: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  /** Override default from for this transport. */
  from?: string;
}

export interface SesProviderOptions {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  configurationSetName?: string;
  endpoint?: string;
  from?: string;
  /** SNS/HTTPS webhook shared secret or topic ARN marker (optional verification helper). */
  webhookSecret?: string;
}

export interface ResendProviderOptions {
  apiKey: string;
  from?: string;
  baseUrl?: string;
  webhookSecret?: string;
}

export interface SendGridProviderOptions {
  apiKey: string;
  from?: string;
  /** Default `https://api.sendgrid.com`; use `https://api.eu.sendgrid.com` for EU. */
  baseUrl?: string;
  /** Optional HMAC secret for webhook verification (custom/proxy setups). */
  webhookSecret?: string;
}

export interface MailgunProviderOptions {
  apiKey: string;
  domain: string;
  from?: string;
  /** `us` (default) or `eu`. Ignored when `baseUrl` is set. */
  region?: 'us' | 'eu';
  baseUrl?: string;
  /** Mailgun webhook signing key (preferred). */
  webhookSigningKey?: string;
  /** Alias for webhookSigningKey. */
  webhookSecret?: string;
}

export interface TemplateEngineOptions {
  dir: string;
  engine?: 'handlebars';
  options?: Record<string, unknown>;
}

export interface MailQueueOptions {
  enabled?: boolean;
  name?: string;
  jobName?: string;
}

export interface MailDefaults {
  from?: string;
  replyTo?: string;
}

export interface MailModuleOptions {
  defaultProvider?: string;
  defaults?: MailDefaults;
  /** Single brand or named brand map. */
  brand?: BrandTheme | Record<string, BrandTheme>;
  policy?: DeliveryPolicyOptions;
  template?: TemplateEngineOptions;
  queue?: MailQueueOptions;
  /** Optional @hazeljs/queue QueueService (or compatible client). */
  queueClient?: MailQueueClient;
  retry?: RetryOptions | false;
  failover?: string[];
  /** Built-in memory provider (tests / local). */
  memory?: boolean | { name?: string };
  /** Built-in log provider (prints to console). */
  log?: boolean | { name?: string };
  smtp?: SmtpProviderOptions;
  ses?: SesProviderOptions;
  resend?: ResendProviderOptions;
  sendgrid?: SendGridProviderOptions;
  mailgun?: MailgunProviderOptions;
  providers?: Record<string, MailProvider>;
  isGlobal?: boolean;
  /** Optional EventEmitterService instance or factory-compatible reference. */
  eventEmitter?: { emit: (event: string, ...values: unknown[]) => unknown };
}

export interface MailModuleAsyncOptions {
  useFactory: (...args: unknown[]) => MailModuleOptions | Promise<MailModuleOptions>;
  inject?: unknown[];
  isGlobal?: boolean;
}

export interface ResolvedMailModuleOptions {
  defaultProvider?: string;
  defaults: MailDefaults;
  brands: Record<string, BrandTheme>;
  policy: DeliveryPolicyOptions;
  template?: TemplateEngineOptions;
  queue: { enabled: boolean; name: string; jobName: string };
  retry: RetryOptions | false;
  failover: string[];
  providers: Record<string, MailProvider>;
  isGlobal: boolean;
  eventEmitter?: { emit: (event: string, ...values: unknown[]) => unknown };
}
