/**
 * Slack channel adapter - Incoming Webhooks for one-way notifications
 * Use for posting messages to Slack from flows, jobs, etc.
 */
import type {
  IChannelAdapter,
  IncomingMessage,
  OutgoingMessage,
  MessagingChannel,
} from '../types/message.types';

export interface SlackAdapterConfig {
  /** Slack Incoming Webhook URL (https://hooks.slack.com/services/...) */
  webhookUrl: string;
}

/** Slack adapter - uses Incoming Webhooks for sending (no incoming webhook handling) */
export class SlackAdapter implements IChannelAdapter {
  readonly channel: MessagingChannel = 'slack';
  private config: SlackAdapterConfig;

  constructor(config: SlackAdapterConfig) {
    this.config = config;
  }

  /** Parse incoming - not supported for Incoming Webhooks (one-way only) */
  parseIncoming(_payload: unknown): IncomingMessage | IncomingMessage[] | null {
    return null;
  }

  /** Send message via Slack Incoming Webhook */
  async send(message: OutgoingMessage): Promise<void> {
    const res = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Slack webhook failed: ${res.status} ${res.statusText} - ${body}`);
    }
  }
}
