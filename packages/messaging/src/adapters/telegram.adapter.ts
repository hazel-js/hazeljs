/**
 * Telegram channel adapter using Telegraf
 */
import { Telegraf } from 'telegraf';
import type {
  IChannelAdapter,
  IncomingMessage,
  OutgoingMessage,
  MessagingChannel,
} from '../types/message.types';

export interface TelegramAdapterConfig {
  botToken: string;
}

/** Telegram adapter - uses Telegraf for webhook handling */
export class TelegramAdapter implements IChannelAdapter {
  readonly channel: MessagingChannel = 'telegram';
  private bot: Telegraf;
  private config: TelegramAdapterConfig;

  constructor(config: TelegramAdapterConfig) {
    this.config = config;
    this.bot = new Telegraf(config.botToken);
  }

  /** Get Telegraf instance for webhook middleware */
  getBot(): Telegraf {
    return this.bot;
  }

  /** Parse Telegram update (from webhook) into IncomingMessage */
  parseIncoming(payload: unknown): IncomingMessage | IncomingMessage[] | null {
    const update = payload as {
      message?: {
        message_id: number;
        chat: { id: number; type?: string };
        from?: { id: number; username?: string; first_name?: string; last_name?: string };
        text?: string;
        date?: number;
      };
      edited_message?: {
        message_id: number;
        chat: { id: number; type?: string };
        from?: { id: number; username?: string; first_name?: string; last_name?: string };
        text?: string;
        date?: number;
      };
    };

    const msg = update.message ?? update.edited_message;
    if (!msg?.text) return null;

    const from = msg.from;
    const chat = msg.chat;
    const fromAny = from as
      | { first_name?: string; last_name?: string; username?: string }
      | undefined;
    const name =
      [fromAny?.first_name, fromAny?.last_name].filter(Boolean).join(' ') || fromAny?.username;
    const chatAny = chat as { id: number; type?: string };

    return {
      id: String(msg.message_id),
      channel: 'telegram',
      conversationId: String(chat.id),
      userId: String(from?.id ?? ''),
      userName: name || undefined,
      text: msg.text,
      rawPayload: payload,
      timestamp: new Date((msg.date ?? 0) * 1000),
      sessionId: `telegram:${chat.id}`,
      metadata: { chatType: chatAny.type },
    };
  }

  /** Send response via Telegram Bot API */
  async send(message: OutgoingMessage): Promise<void> {
    const chatId = message.conversationId;
    const opts: { reply_to_message_id?: number } = {};
    if (message.replyToMessageId) {
      opts.reply_to_message_id = parseInt(message.replyToMessageId, 10);
    }
    await this.bot.telegram.sendMessage(chatId, message.text, opts as Record<string, unknown>);
  }

  /** Register handler that receives IncomingMessage and sends response via this adapter */
  onMessage(handler: (msg: IncomingMessage) => Promise<string> | string): void {
    this.bot.on('text', async (ctx: { update: unknown }) => {
      const normalized = this.parseIncoming(ctx.update);
      if (!normalized || Array.isArray(normalized)) return;
      const response = await handler(normalized);
      if (response) {
        await this.send({
          conversationId: normalized.conversationId,
          text: response,
          replyToMessageId: normalized.id,
        });
      }
    });
  }
}
