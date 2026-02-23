/**
 * Microsoft Teams channel adapter - Incoming Webhooks for one-way notifications
 * Use for posting messages to Teams from flows, jobs, etc.
 */
import type {
  IChannelAdapter,
  IncomingMessage,
  OutgoingMessage,
  MessagingChannel,
} from '../types/message.types';

export interface TeamsAdapterConfig {
  /** Teams Incoming Webhook URL (https://*.webhook.office.com/...) */
  webhookUrl: string;
}

/** Teams adapter - uses Incoming Webhooks for sending (no incoming webhook handling) */
export class TeamsAdapter implements IChannelAdapter {
  readonly channel: MessagingChannel = 'teams';
  private config: TeamsAdapterConfig;

  constructor(config: TeamsAdapterConfig) {
    this.config = config;
  }

  /** Parse incoming - not supported for Incoming Webhooks (one-way only) */
  parseIncoming(_payload: unknown): IncomingMessage | IncomingMessage[] | null {
    return null;
  }

  /** Send message via Teams Incoming Webhook (simple text format) */
  async send(message: OutgoingMessage): Promise<void> {
    const res = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Teams webhook failed: ${res.status} ${res.statusText} - ${body}`);
    }
  }
}
