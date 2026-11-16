import type {
  EmailDocument,
  MailAddress,
  MailAttachment,
  MailCategory,
  MailCta,
  MailIcsPart,
  MailLayout,
  MailSection,
  MailUnsubscribe,
} from '../types/email-document';

function asAddressList(value: MailAddress | MailAddress[]): MailAddress[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Fluent builder for EmailDocument — the primary authoring surface for @hazeljs/mail.
 */
export class EmailComposer {
  private doc: Partial<EmailDocument> = {
    category: 'transactional',
    layout: 'transactional',
    sections: [],
    to: [],
  };

  category(category: MailCategory): this {
    this.doc.category = category;
    return this;
  }

  subject(subject: string): this {
    this.doc.subject = subject;
    return this;
  }

  to(address: MailAddress | MailAddress[]): this {
    this.doc.to = asAddressList(address);
    return this;
  }

  cc(address: MailAddress | MailAddress[]): this {
    this.doc.cc = asAddressList(address);
    return this;
  }

  bcc(address: MailAddress | MailAddress[]): this {
    this.doc.bcc = asAddressList(address);
    return this;
  }

  from(address: MailAddress): this {
    this.doc.from = address;
    return this;
  }

  replyTo(address: MailAddress): this {
    this.doc.replyTo = address;
    return this;
  }

  brand(brandKey: string): this {
    this.doc.brand = brandKey;
    return this;
  }

  layout(layout: MailLayout): this {
    this.doc.layout = layout;
    return this;
  }

  section(section: MailSection): this {
    this.doc.sections = [...(this.doc.sections ?? []), section];
    return this;
  }

  sections(sections: MailSection[]): this {
    this.doc.sections = [...(this.doc.sections ?? []), ...sections];
    return this;
  }

  cta(cta: MailCta): this {
    this.doc.cta = cta;
    return this;
  }

  html(html: string): this {
    this.doc.html = html;
    return this;
  }

  text(text: string): this {
    this.doc.text = text;
    return this;
  }

  attach(attachment: MailAttachment): this {
    this.doc.attachments = [...(this.doc.attachments ?? []), attachment];
    return this;
  }

  ics(ics: MailIcsPart): this {
    this.doc.ics = ics;
    return this;
  }

  unsubscribe(unsubscribe: MailUnsubscribe): this {
    this.doc.unsubscribe = unsubscribe;
    return this;
  }

  headers(headers: Record<string, string>): this {
    this.doc.headers = { ...(this.doc.headers ?? {}), ...headers };
    return this;
  }

  tags(tags: Record<string, string>): this {
    this.doc.tags = { ...(this.doc.tags ?? {}), ...tags };
    return this;
  }

  metadata(metadata: Record<string, unknown>): this {
    this.doc.metadata = { ...(this.doc.metadata ?? {}), ...metadata };
    return this;
  }

  idempotencyKey(key: string): this {
    this.doc.idempotencyKey = key;
    return this;
  }

  locale(locale: string): this {
    this.doc.locale = locale;
    return this;
  }

  provider(provider: string): this {
    this.doc.provider = provider;
    return this;
  }

  correlationId(id: string): this {
    this.doc.correlationId = id;
    return this;
  }

  build(): EmailDocument {
    if (!this.doc.subject) {
      throw new Error('EmailDocument requires a subject');
    }
    if (!this.doc.to || this.doc.to.length === 0) {
      throw new Error('EmailDocument requires at least one recipient');
    }
    return {
      to: this.doc.to,
      cc: this.doc.cc,
      bcc: this.doc.bcc,
      from: this.doc.from,
      replyTo: this.doc.replyTo,
      subject: this.doc.subject,
      category: this.doc.category ?? 'transactional',
      brand: this.doc.brand,
      layout: this.doc.layout ?? 'transactional',
      sections: this.doc.sections ?? [],
      cta: this.doc.cta,
      html: this.doc.html,
      text: this.doc.text,
      attachments: this.doc.attachments,
      ics: this.doc.ics,
      unsubscribe: this.doc.unsubscribe,
      headers: this.doc.headers,
      tags: this.doc.tags,
      metadata: this.doc.metadata,
      idempotencyKey: this.doc.idempotencyKey,
      locale: this.doc.locale,
      provider: this.doc.provider,
      correlationId: this.doc.correlationId,
    };
  }
}

/** Start a new structured email. */
export function email(): EmailComposer {
  return new EmailComposer();
}
