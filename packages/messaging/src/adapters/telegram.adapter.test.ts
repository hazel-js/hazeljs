/**
 * TelegramAdapter tests
 */
import { TelegramAdapter } from './telegram.adapter';
import { Telegraf } from 'telegraf';

// Mock Telegraf to avoid actual Telegram API calls
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
let capturedTextHandler: ((ctx: { update: unknown }) => Promise<void>) | null = null;

jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: mockSendMessage },
    on: jest.fn((event: string, handler: (ctx: { update: unknown }) => Promise<void>) => {
      if (event === 'text') capturedTextHandler = handler;
    }),
  })),
}));

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;

  beforeEach(() => {
    capturedTextHandler = null;
    mockSendMessage.mockClear();
    adapter = new TelegramAdapter({ botToken: 'test-token' });
  });

  describe('channel', () => {
    it('has channel telegram', () => {
      expect(adapter.channel).toBe('telegram');
    });
  });

  describe('getBot', () => {
    it('returns Telegraf instance', () => {
      const bot = adapter.getBot();
      expect(bot).toBeDefined();
      expect(bot.telegram).toBeDefined();
    });
  });

  describe('parseIncoming', () => {
    it('returns null when no text message', () => {
      expect(adapter.parseIncoming({})).toBeNull();
      expect(adapter.parseIncoming({ message: { chat: {}, from: {} } })).toBeNull();
    });

    it('parses message from update.message', () => {
      const payload = {
        message: {
          message_id: 42,
          chat: { id: -100123, type: 'group' },
          from: { id: 12345, username: 'johndoe', first_name: 'John', last_name: 'Doe' },
          text: 'Hello bot',
          date: 1609459200,
        },
      };

      const result = adapter.parseIncoming(payload);
      expect(result).not.toBeNull();
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.id).toBe('42');
      expect(msg?.channel).toBe('telegram');
      expect(msg?.conversationId).toBe('-100123');
      expect(msg?.userId).toBe('12345');
      expect(msg?.userName).toBe('John Doe');
      expect(msg?.text).toBe('Hello bot');
      expect(msg?.sessionId).toBe('telegram:-100123');
      expect(msg?.metadata?.chatType).toBe('group');
    });

    it('parses edited_message', () => {
      const payload = {
        edited_message: {
          message_id: 43,
          chat: { id: 999 },
          from: { id: 1 },
          text: 'Edited text',
        },
      };

      const result = adapter.parseIncoming(payload);
      expect(result).not.toBeNull();
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.text).toBe('Edited text');
      expect(msg?.id).toBe('43');
    });

    it('uses username when first/last name not available', () => {
      const payload = {
        message: {
          message_id: 1,
          chat: { id: 1 },
          from: { id: 1, username: 'bob' },
          text: 'Hi',
        },
      };

      const result = adapter.parseIncoming(payload);
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.userName).toBe('bob');
    });
  });

  describe('send', () => {
    it('sends message via Telegraf', async () => {
      const mockInstance = (Telegraf as unknown as jest.Mock).mock.results[0]?.value;

      await adapter.send({
        conversationId: '123',
        text: 'Hello user',
        replyToMessageId: '42',
      });

      expect(mockInstance.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        'Hello user',
        expect.objectContaining({ reply_to_message_id: 42 })
      );
    });

    it('sends without reply when replyToMessageId not provided', async () => {
      const mockInstance = (Telegraf as unknown as jest.Mock).mock.results[0]?.value;

      await adapter.send({
        conversationId: '456',
        text: 'Standalone',
      });

      expect(mockInstance.telegram.sendMessage).toHaveBeenCalledWith('456', 'Standalone', {});
    });
  });

  describe('onMessage', () => {
    it('invokes handler and sends reply when handler returns response', async () => {
      const handler = jest.fn().mockResolvedValue('Echo: Hello');
      adapter.onMessage(handler);

      expect(capturedTextHandler).not.toBeNull();
      await capturedTextHandler!({
        update: {
          message: {
            message_id: 1,
            chat: { id: 123 },
            from: { id: 1 },
            text: 'Hello',
          },
        },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          conversationId: '123',
          text: 'Hello',
        })
      );
      expect(mockSendMessage).toHaveBeenCalledWith('123', 'Echo: Hello', expect.any(Object));
    });

    it('does not send when handler returns empty string', async () => {
      const handler = jest.fn().mockResolvedValue('');
      adapter.onMessage(handler);

      await capturedTextHandler!({
        update: {
          message: {
            message_id: 2,
            chat: { id: 456 },
            from: { id: 2 },
            text: 'Hi',
          },
        },
      });

      expect(handler).toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });
});
