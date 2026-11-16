import type {
  EmailDocument,
  MailAddress,
  MailCategory,
  NormalizedMailMessage,
} from './email-document';

export interface ProviderSendResult {
  messageId: string;
  provider: string;
  accepted?: string[];
  rejected?: string[];
  raw?: unknown;
}

export interface SendResult extends ProviderSendResult {
  correlationId?: string;
  status: 'sent' | 'queued' | 'suppressed' | 'intercepted' | 'deferred';
  /** Present when status is suppressed/deferred. */
  reason?: string;
}

export interface SendTemplateOptions {
  to: MailAddress | MailAddress[];
  context: Record<string, unknown>;
  subject?: string;
  from?: MailAddress;
  category?: MailCategory;
  provider?: string;
  idempotencyKey?: string;
  correlationId?: string;
  locale?: string;
  tags?: Record<string, string>;
  cc?: MailAddress | MailAddress[];
  bcc?: MailAddress | MailAddress[];
}

export interface SendMailableOptions<T = Record<string, unknown>> {
  to: MailAddress | MailAddress[];
  data: T;
  provider?: string;
  idempotencyKey?: string;
  correlationId?: string;
  locale?: string;
}

export interface RetryOptions {
  attempts?: number;
  backoff?: 'fixed' | 'exponential';
  delayMs?: number;
  /** Return true to retry this error. */
  retryIf?: (error: unknown) => boolean;
}

export type SendInput = EmailDocument | NormalizedMailMessage;
