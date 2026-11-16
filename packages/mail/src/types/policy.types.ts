import type { EmailDocument, MailCategory } from './email-document';

export interface InterceptOptions {
  enabled?: boolean;
  to: string | string[];
  allow?: (address: string) => boolean | Promise<boolean>;
  subjectPrefix?: string;
}

export interface QuietHoursOptions {
  category: MailCategory | MailCategory[];
  /** IANA timezone (informational; quiet hours use local offset via Date unless a custom clock is injected). */
  tz?: string;
  /** Hour 0–23 inclusive start (local). */
  start: number;
  /** Hour 0–23 exclusive end (local). */
  end: number;
}

export interface RateLimitOptions {
  maxMessages: number;
  /** Window in ms. Default 60_000. */
  periodMs?: number;
  /** Key by recipient email, tenant id from tags, or custom. Default recipient. */
  key?: 'recipient' | 'tenant' | ((doc: EmailDocument) => string);
}

export interface DeliveryPolicyOptions {
  intercept?: InterceptOptions;
  /** Drop recipient when returns true. */
  suppress?: (address: string, doc: EmailDocument) => boolean | Promise<boolean>;
  quietHours?: QuietHoursOptions | QuietHoursOptions[];
  rateLimit?: RateLimitOptions;
  /** Validate addresses/subject/headers before send. Default true. */
  validate?: boolean;
}

export type PolicyDecision =
  | { action: 'allow'; recipients: string[] }
  | { action: 'suppress'; reason: string; recipients: string[] }
  | {
      action: 'intercept';
      recipients: string[];
      originalRecipients: string[];
      subjectPrefix?: string;
    }
  | { action: 'defer'; reason: string; retryAfterMs?: number };
