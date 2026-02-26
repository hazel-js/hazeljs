/**
 * Viber channel adapter
 * Uses viber-bot (optional dependency)
 */
import type {
  IChannelAdapter,
  IncomingMessage,
  OutgoingMessage,
  MessagingChannel,
} from '../types/message.types';

export interface ViberAdapterConfig {
  authToken: string;
  /** Webhook path, e.g. /viber/webhook */
  webhookPath?: string;
}

/** Viber adapter - requires viber-bot to be installed */
export class ViberAdapter implements IChannelAdapter {
  readonly channel: MessagingChannel = 'viber';
  private config: ViberAdapterConfig;
  private bot: unknown = null;

  constructor(config: ViberAdapterConfig) {
    this.config = config;
    this.initBot();
  }

  private initBot(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ViberBot = require('viber-bot').default;
      this.bot = new ViberBot({
        authToken: this.config.authToken,
        name: 'HazelJS Bot',
        avatar: '',
      });
    } catch {
      this.bot = null;
    }
  }

  /** Get raw viber-bot instance for advanced use */
  getBot(): unknown {
    return this.bot;
  }

  /** Parse Viber webhook payload into IncomingMessage */
  parseIncoming(payload: unknown): IncomingMessage | IncomingMessage[] | null {
    const event = payload as {
      event?: string;
      message?: { text?: string };
      sender?: { id: string; name?: string };
      message_token?: number;
      timestamp?: number;
    };

    if (event.event !== 'message' || !event.message?.text) return null;

    const sender = event.sender;
    return {
      id: String(event.message_token ?? Date.now()),
      channel: 'viber',
      conversationId: sender?.id ?? '',
      userId: sender?.id ?? '',
      userName: sender?.name,
      text: event.message.text,
      rawPayload: payload,
      timestamp: new Date(event.timestamp ?? Date.now()),
      sessionId: sender?.id ? `viber:${sender.id}` : undefined,
    };
  }

  /** Send response via Viber API */
  async send(message: OutgoingMessage): Promise<void> {
    if (!this.bot) {
      throw new Error('viber-bot is not installed. Run: npm install viber-bot');
    }
    const bot = this.bot as {
      sendMessage: (sender: { id: string }, text: string) => Promise<void>;
    };
    await bot.sendMessage({ id: message.conversationId }, message.text);
  }

  /** Register message handler - use with viber-bot middleware */
  onMessage(handler: (msg: IncomingMessage) => Promise<string> | string): void {
    if (!this.bot) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- viber-bot is optional peer dep
    const Events = require('viber-bot').Events;
    (this.bot as { on: (ev: string, cb: (msg: unknown) => void) => void }).on(
      Events.MESSAGE_RECEIVED,
      async (message: unknown) => {
        const m = message as {
          sender: { id: string; name?: string };
          text?: string;
          messageToken?: number;
        };
        if (!m.text) return;
        const normalized: IncomingMessage = {
          id: String(m.messageToken ?? Date.now()),
          channel: 'viber',
          conversationId: m.sender.id,
          userId: m.sender.id,
          userName: m.sender.name,
          text: m.text,
          timestamp: new Date(),
          sessionId: `viber:${m.sender.id}`,
        };
        const response = await handler(normalized);
        if (response) {
          await this.send({
            conversationId: normalized.conversationId,
            text: response,
          });
        }
      }
    );
  }

  /** Express/Hazel middleware for Viber webhook */
  webhookMiddleware(): (req: unknown, res: unknown, next?: () => void) => void {
    if (!this.bot) {
      return (_req: unknown, _res: unknown, next?: () => void) => {
        if (next) next();
      };
    }
    const bot = this.bot as {
      middleware: () => (req: unknown, res: unknown, next?: () => void) => void;
    };
    return bot.middleware();
  }
}
