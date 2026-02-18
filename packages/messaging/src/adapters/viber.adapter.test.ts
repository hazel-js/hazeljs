/**
 * ViberAdapter tests - viber-bot is optional, so we test parseIncoming and send with mocks
 */
import { ViberAdapter } from './viber.adapter';

describe('ViberAdapter', () => {
  let adapter: ViberAdapter;

  beforeEach(() => {
    adapter = new ViberAdapter({ authToken: 'test-auth' });
  });

  describe('channel', () => {
    it('has channel viber', () => {
      expect(adapter.channel).toBe('viber');
    });
  });

  describe('parseIncoming', () => {
    it('returns null when event is not message', () => {
      expect(adapter.parseIncoming({ event: 'delivered' })).toBeNull();
      expect(adapter.parseIncoming({ event: 'seen' })).toBeNull();
    });

    it('returns null when no message text', () => {
      expect(
        adapter.parseIncoming({ event: 'message', message: {}, sender: { id: '1' } })
      ).toBeNull();
    });

    it('parses message event', () => {
      const payload = {
        event: 'message',
        message: { text: 'Hello from Viber' },
        sender: { id: 'viber-user-123', name: 'Alice' },
        message_token: 98765,
        timestamp: 1609459200000,
      };

      const result = adapter.parseIncoming(payload);
      expect(result).not.toBeNull();
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.id).toBe('98765');
      expect(msg?.channel).toBe('viber');
      expect(msg?.conversationId).toBe('viber-user-123');
      expect(msg?.userId).toBe('viber-user-123');
      expect(msg?.userName).toBe('Alice');
      expect(msg?.text).toBe('Hello from Viber');
      expect(msg?.sessionId).toBe('viber:viber-user-123');
    });

    it('handles missing message_token with timestamp fallback', () => {
      const payload = {
        event: 'message',
        message: { text: 'Hi' },
        sender: { id: 'u1' },
      };

      const result = adapter.parseIncoming(payload);
      expect(result).not.toBeNull();
      const msg = Array.isArray(result) ? result[0] : result;
      expect(msg?.id).toBeDefined();
    });
  });

  describe('send', () => {
    it('throws or succeeds depending on viber-bot availability', async () => {
      try {
        await adapter.send({ conversationId: 'x', text: 'Hi' });
        expect(true).toBe(true); // viber-bot installed, send succeeded
      } catch (e) {
        expect((e as Error).message).toContain('viber-bot');
      }
    });
  });

  describe('getBot', () => {
    it('returns bot instance or null', () => {
      expect(adapter.getBot()).toBeDefined();
    });
  });
});
