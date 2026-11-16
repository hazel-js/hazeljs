import type { NormalizedMailMessage } from '../types/email-document';
import type { ProviderSendResult } from '../types/send.types';
import type { MailProvider } from './provider.interface';

export const MEMORY_PROVIDER_NAME = 'memory';

export interface MemoryMailboxEntry {
  message: NormalizedMailMessage;
  result: ProviderSendResult;
  sentAt: Date;
}

/** In-memory provider for tests and local development. */
export class MemoryMailProvider implements MailProvider {
  readonly name: string;
  readonly mailbox: MemoryMailboxEntry[] = [];
  private seq = 0;

  constructor(name: string = MEMORY_PROVIDER_NAME) {
    this.name = name;
  }

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    this.seq += 1;
    const result: ProviderSendResult = {
      messageId: message.idempotencyKey ?? `memory-${this.seq}`,
      provider: this.name,
      accepted: message.to,
    };
    this.mailbox.push({ message, result, sentAt: new Date() });
    return result;
  }

  async health(): Promise<'up' | 'down'> {
    return 'up';
  }

  clear(): void {
    this.mailbox.length = 0;
  }

  findByRecipient(email: string): MemoryMailboxEntry[] {
    const needle = email.toLowerCase();
    return this.mailbox.filter((entry) =>
      entry.message.to.some((to) => to.toLowerCase().includes(needle))
    );
  }

  latest(): MemoryMailboxEntry | undefined {
    return this.mailbox[this.mailbox.length - 1];
  }
}
