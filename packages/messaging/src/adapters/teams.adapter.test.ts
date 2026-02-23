/**
 * TeamsAdapter tests
 */
import { TeamsAdapter } from './teams.adapter';

const originalFetch = globalThis.fetch;

describe('TeamsAdapter', () => {
  let adapter: TeamsAdapter;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    adapter = new TeamsAdapter({
      webhookUrl: 'https://outlook.webhook.office.com/webhookb2/xxx',
    });
  });

  afterEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  describe('channel', () => {
    it('has channel teams', () => {
      expect(adapter.channel).toBe('teams');
    });
  });

  describe('parseIncoming', () => {
    it('returns null (Incoming Webhooks are one-way)', () => {
      expect(adapter.parseIncoming({})).toBeNull();
      expect(adapter.parseIncoming({ any: 'payload' })).toBeNull();
    });
  });

  describe('send', () => {
    it('sends message via Teams Incoming Webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await adapter.send({
        conversationId: 'ignored',
        text: 'Hello from HazelJS',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://outlook.webhook.office.com/webhookb2/xxx',
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
        text: async () => 'webhook_expired',
      });

      await expect(adapter.send({ conversationId: 'x', text: 'Hi' })).rejects.toThrow(
        'Teams webhook failed'
      );
    });
  });
});
