import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailLifecycleEvent } from '../types/webhook.types';

/**
 * Implement this interface to add a mail backend (SMTP, SES, Resend, custom).
 */
export interface MailProvider {
  readonly name: string;

  send(message: NormalizedMailMessage): Promise<ProviderSendResult>;

  health?(): Promise<'up' | 'down'>;

  isWebhookConfigured?(): boolean;

  parseWebhookEvent?(
    payload: string | Buffer,
    headers: Record<string, string>
  ): MailLifecycleEvent | MailLifecycleEvent[];
}
