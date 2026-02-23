/**
 * WhatsApp Cloud API channel adapter
 * Uses Meta's Cloud API (Graph API) - no Puppeteer/QR required
 */
import type {
  IChannelAdapter,
  IncomingMessage,
  OutgoingMessage,
  MessagingChannel,
} from '../types/message.types';

export interface WhatsAppAdapterConfig {
  accessToken: string;
  phoneNumberId: string;
  /** Graph API version, e.g. v18.0 */
  apiVersion?: string;
}

const GRAPH_BASE = 'https://graph.facebook.com';

/** WhatsApp Cloud API adapter */
export class WhatsAppAdapter implements IChannelAdapter {
  readonly channel: MessagingChannel = 'whatsapp';
  private config: WhatsAppAdapterConfig;
  private baseUrl: string;

  constructor(config: WhatsAppAdapterConfig) {
    this.config = {
      apiVersion: 'v18.0',
      ...config,
    };
    this.baseUrl = `${GRAPH_BASE}/${this.config.apiVersion}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatsApp API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  /** Parse WhatsApp webhook payload into IncomingMessage(s) */
  parseIncoming(payload: unknown): IncomingMessage | IncomingMessage[] | null {
    const body = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              id: string;
              from: string;
              timestamp: string;
              type: string;
              text?: { body: string };
              context?: { id: string };
            }>;
            contacts?: Array<{ profile: { name: string } }>;
          };
        }>;
      }>;
    };

    const messages: IncomingMessage[] = [];
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;
        for (const msg of value.messages) {
          if (msg.type !== 'text' || !msg.text?.body) continue;
          const contact = value.contacts?.[0]?.profile?.name;
          messages.push({
            id: msg.id,
            channel: 'whatsapp',
            conversationId: msg.from,
            userId: msg.from,
            userName: contact,
            text: msg.text.body,
            rawPayload: msg,
            timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
            sessionId: `whatsapp:${msg.from}`,
            metadata: { contextId: msg.context?.id },
          });
        }
      }
    }

    if (messages.length === 0) return null;
    if (messages.length === 1) return messages[0];
    return messages;
  }

  /** Send text message via WhatsApp Cloud API */
  async send(message: OutgoingMessage): Promise<void> {
    await this.request(`/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.conversationId.replace(/\D/g, ''),
        type: 'text',
        text: { body: message.text },
        context: message.replyToMessageId ? { message_id: message.replyToMessageId } : undefined,
      }),
    });
  }

  /** Verify webhook subscription (Meta sends hub.mode, hub.verify_token) */
  verifyWebhook(payload: unknown, _headers?: Record<string, string>): boolean {
    const q = payload as { 'hub.mode'?: string; 'hub.verify_token'?: string };
    const token = process.env.WHATSAPP_VERIFY_TOKEN;
    return q['hub.mode'] === 'subscribe' && !!token && q['hub.verify_token'] === token;
  }
}
