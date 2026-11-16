export type MailLifecycleType =
  'bounce' | 'complaint' | 'delivery' | 'open' | 'click' | 'reject' | 'unknown';

export interface MailLifecycleEvent {
  type: MailLifecycleType;
  provider: string;
  messageId?: string;
  recipient?: string;
  timestamp?: string;
  reason?: string;
  url?: string;
  raw?: unknown;
}
