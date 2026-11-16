import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailProvider } from './provider.interface';

export const LOG_PROVIDER_NAME = 'log';

/** Dev provider that logs the rendered message instead of sending. */
export class LogMailProvider implements MailProvider {
  readonly name: string;
  private seq = 0;

  constructor(name: string = LOG_PROVIDER_NAME) {
    this.name = name;
  }

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    this.seq += 1;
    const messageId = message.idempotencyKey ?? `log-${this.seq}`;
    // eslint-disable-next-line no-console
    console.info('[@hazeljs/mail]', {
      messageId,
      to: message.to,
      subject: message.subject,
      category: message.category,
      correlationId: message.correlationId,
      textPreview: message.text.slice(0, 200),
    });
    return {
      messageId,
      provider: this.name,
      accepted: message.to,
    };
  }

  async health(): Promise<'up' | 'down'> {
    return 'up';
  }
}
