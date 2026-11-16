import type { SmtpProviderOptions } from '../types/module.types';
import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailProvider } from './provider.interface';
import { renderIcs } from '../render/ics';

export const SMTP_PROVIDER_NAME = 'smtp';

type NodemailerTransport = {
  sendMail: (
    options: Record<string, unknown>
  ) => Promise<{ messageId?: string; accepted?: string[]; rejected?: string[] }>;
  verify?: () => Promise<true>;
  close?: () => void;
};

/** SMTP provider backed by optional peer dependency `nodemailer`. */
export class SmtpMailProvider implements MailProvider {
  readonly name = SMTP_PROVIDER_NAME;
  private transporter: NodemailerTransport | null = null;

  constructor(private readonly options: SmtpProviderOptions) {}

  private getTransporter(): NodemailerTransport {
    if (this.transporter) {
      return this.transporter;
    }
    let nodemailer: { createTransport: (opts: unknown) => NodemailerTransport };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nodemailer = require('nodemailer');
    } catch {
      throw new Error('nodemailer is required for SMTP. Install it with: npm install nodemailer');
    }
    this.transporter = nodemailer.createTransport({
      host: this.options.host,
      port: this.options.port ?? 587,
      secure: this.options.secure ?? false,
      auth: this.options.auth,
    });
    return this.transporter;
  }

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    const attachments = [...(message.attachments ?? [])].map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      cid: a.cid,
      contentDisposition: a.contentDisposition,
    }));

    // ICS parts are attached when present on metadata (normalized pipeline may attach separately)
    const icsContent = message.metadata?.icsContent;
    if (typeof icsContent === 'string') {
      attachments.push({
        filename: 'invite.ics',
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST',
        cid: undefined,
        contentDisposition: 'attachment',
      });
    }

    const info = await this.getTransporter().sendMail({
      from: message.from || this.options.from,
      to: message.to.join(', '),
      cc: message.cc?.join(', '),
      bcc: message.bcc?.join(', '),
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      attachments,
      messageId: message.idempotencyKey,
    });

    return {
      messageId: info.messageId ?? message.idempotencyKey ?? `smtp-${Date.now()}`,
      provider: this.name,
      accepted: (info.accepted as string[] | undefined) ?? message.to,
      rejected: info.rejected as string[] | undefined,
      raw: info,
    };
  }

  async health(): Promise<'up' | 'down'> {
    try {
      const t = this.getTransporter();
      if (t.verify) {
        await t.verify();
      }
      return 'up';
    } catch {
      return 'down';
    }
  }
}

export function attachIcsToMessage(
  message: NormalizedMailMessage,
  ics: Parameters<typeof renderIcs>[0]
): NormalizedMailMessage {
  return {
    ...message,
    metadata: { ...message.metadata, icsContent: renderIcs(ics) },
  };
}
