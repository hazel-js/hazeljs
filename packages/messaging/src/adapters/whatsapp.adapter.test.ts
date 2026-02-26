/**
 * WhatsAppAdapter tests
 */
import { WhatsAppAdapter } from './whatsapp.adapter';

const originalFetch = globalThis.fetch;

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    adapter = new WhatsAppAdapter({
      accessToken: 'test-token',
      phoneNumberId: '123456789',
    });
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  describe('channel', () => {
    it('has channel whatsapp', () => {
      expect(adapter.channel).toBe('whatsapp');
    });
  });

  describe('parseIncoming', () => {
    it('returns null for empty payload', () => {
      expect(adapter.parseIncoming({})).toBeNull();
    });

    it('parses single text message', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.abc',
                      from: '1234567890',
                      timestamp: '1609459200',
                      type: 'text',
                      text: { body: 'Hello from user' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = adapter.parseIncoming(payload);
      expect(result).not.toBeNull();
      const msg = Array.isArray(result) ? result[0] : result!;
      expect(msg).toBeDefined();
      expect(msg.id).toBe('wamid.abc');
      expect(msg.channel).toBe('whatsapp');
      expect(msg.conversationId).toBe('1234567890');
      expect(msg.userId).toBe('1234567890');
      expect(msg.text).toBe('Hello from user');
      expect(msg.sessionId).toBe('whatsapp:1234567890');
    });

    it('parses multiple messages', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { id: '1', from: 'u1', timestamp: '1', type: 'text', text: { body: 'A' } },
                    { id: '2', from: 'u1', timestamp: '2', type: 'text', text: { body: 'B' } },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = adapter.parseIncoming(payload);
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(2);
    });

    it('includes contact name when available', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: '1',
                      from: '123',
                      timestamp: '1',
                      type: 'text',
                      text: { body: 'Hi' },
                    },
                  ],
                  contacts: [{ profile: { name: 'John Doe' } }],
                },
              },
            ],
          },
        ],
      };

      const result = adapter.parseIncoming(payload);
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.userName).toBe('John Doe');
    });

    it('skips non-text messages', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { id: '1', from: 'u1', timestamp: '1', type: 'image' },
                    { id: '2', from: 'u1', timestamp: '2', type: 'text' },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = adapter.parseIncoming(payload);
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.text).toBeUndefined();
      expect(msg).toBeNull();
    });

    it('returns null when no messages in entry', () => {
      const payload = { entry: [{ changes: [{ value: {} }] }] };
      expect(adapter.parseIncoming(payload)).toBeNull();
    });
  });

  describe('send', () => {
    it('sends message via Graph API', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await adapter.send({
        conversationId: '1234567890',
        text: 'Hello back',
        replyToMessageId: 'wamid.xyz',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('Hello back'),
        })
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('1234567890');
      expect(body.context?.message_id).toBe('wamid.xyz');
    });

    it('strips non-digits from conversationId', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await adapter.send({
        conversationId: '+1 (234) 567-8901',
        text: 'Hi',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.to).toBe('12345678901');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({ ok: false, text: async () => 'Invalid token' });

      await expect(adapter.send({ conversationId: '123', text: 'Hi' })).rejects.toThrow(
        'WhatsApp API error'
      );
    });
  });

  describe('verifyWebhook', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns true when hub.mode=subscribe and verify_token matches', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'my-secret';
      const q = { 'hub.mode': 'subscribe', 'hub.verify_token': 'my-secret' };
      expect(adapter.verifyWebhook(q)).toBe(true);
    });

    it('returns false when verify_token does not match', () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'my-secret';
      const q = { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong' };
      expect(adapter.verifyWebhook(q)).toBe(false);
    });

    it('returns false when WHATSAPP_VERIFY_TOKEN not set', () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      const q = { 'hub.mode': 'subscribe', 'hub.verify_token': 'x' };
      expect(adapter.verifyWebhook(q)).toBe(false);
    });
  });
});
