/**
 * SlackAdapter tests
 */
import { SlackAdapter } from './slack.adapter';

const originalFetch = globalThis.fetch;

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    adapter = new SlackAdapter({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/XXX',
    });
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  describe('channel', () => {
    it('has channel slack', () => {
      expect(adapter.channel).toBe('slack');
    });
  });

  describe('parseIncoming', () => {
    it('returns null (Incoming Webhooks are one-way)', () => {
      expect(adapter.parseIncoming({})).toBeNull();
      expect(adapter.parseIncoming({ any: 'payload' })).toBeNull();
    });
  });

  describe('send', () => {
    it('sends message via Slack Incoming Webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await adapter.send({
        conversationId: 'ignored',
        text: 'Hello from HazelJS',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T00/B00/XXX',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Hello from HazelJS' }),
        })
      );
    });

    it('throws on webhook failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_payload',
      });

      await expect(adapter.send({ conversationId: 'x', text: 'Hi' })).rejects.toThrow(
        'Slack webhook failed'
      );
    });
  });
});
