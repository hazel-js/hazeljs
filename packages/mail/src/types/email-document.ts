/**
 * First-class email domain model — structured document AST.
 * Providers never see Compose; they receive a NormalizedMailMessage after render.
 */

export type MailCategory = 'transactional' | 'marketing' | 'security';

export type MailAddress = string | { name?: string; address: string };

export interface MailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  cid?: string;
  contentDisposition?: 'attachment' | 'inline';
}

export interface MailSection {
  heading?: string;
  body: string;
  /** Optional HTML body override for this section. */
  html?: string;
}

export interface MailCta {
  label: string;
  href: string;
}

export interface MailIcsPart {
  method?: 'REQUEST' | 'CANCEL' | 'REPLY' | 'PUBLISH';
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string | Date;
  end: string | Date;
  organizer?: string;
  attendees?: string[];
}

export interface MailUnsubscribe {
  url: string;
  /** One-click POST URL (List-Unsubscribe=One-Click). */
  oneClickUrl?: string;
  categories?: string[];
}

export type MailLayout = 'plain' | 'marketing' | 'transactional';

export interface EmailDocument {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  from?: MailAddress;
  replyTo?: MailAddress;
  subject: string;
  category: MailCategory;
  brand?: string;
  layout: MailLayout;
  sections: MailSection[];
  cta?: MailCta;
  /** Pre-rendered HTML (skips compose HTML renderer when set). */
  html?: string;
  /** Pre-rendered plain text. */
  text?: string;
  attachments?: MailAttachment[];
  ics?: MailIcsPart;
  unsubscribe?: MailUnsubscribe;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  locale?: string;
  provider?: string;
  correlationId?: string;
}

/** Wire-ready message after policy + render. */
export interface NormalizedMailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
  headers: Record<string, string>;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
  category: MailCategory;
  idempotencyKey?: string;
  correlationId?: string;
  provider?: string;
}
