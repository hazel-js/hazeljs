import { createHmac } from 'crypto';
import { MailgunMailProvider } from './mailgun.provider';

describe('MailgunMailProvider', () => {
  it('parses event-data webhooks', () => {
    const provider = new MailgunMailProvider({
      apiKey: 'key-test',
      domain: 'mg.example.com',
    });
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        'event-data': {
          event: 'delivered',
          recipient: 'user@example.com',
          timestamp: 1700000000,
          'message-id': '<id@mailgun>',
        },
      }),
      {}
    );
    expect(event.type).toBe('delivery');
    expect(event.recipient).toBe('user@example.com');
    expect(event.messageId).toBe('<id@mailgun>');
  });

  it('verifies nested Mailgun signatures', () => {
    const signingKey = 'whsec_mailgun';
    const timestamp = '1700000000';
    const token = 'token123';
    const signature = createHmac('sha256', signingKey)
      .update(timestamp + token)
      .digest('hex');

    const provider = new MailgunMailProvider({
      apiKey: 'key-test',
      domain: 'mg.example.com',
      webhookSigningKey: signingKey,
    });

    const event = provider.parseWebhookEvent(
      JSON.stringify({
        signature: { timestamp, token, signature },
        'event-data': {
          event: 'failed',
          recipient: 'bounce@example.com',
          reason: 'bounce',
        },
      }),
      {}
    );
    expect(event.type).toBe('bounce');
    expect(event.recipient).toBe('bounce@example.com');
  });

  it('defaults to EU host when region is eu', () => {
    const provider = new MailgunMailProvider({
      apiKey: 'key',
      domain: 'mg.example.com',
      region: 'eu',
    });
    // Access private via send failure path with mocked fetch
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('api.eu.mailgun.net');
      return {
        ok: true,
        json: async () => ({ id: '<eu-id>' }),
      } as Response;
    }) as typeof fetch;

    return provider
      .send({
        to: ['a@b.com'],
        from: 'Hazel <noreply@mg.example.com>',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        headers: {},
        category: 'transactional',
      })
      .then((result) => {
        expect(result.messageId).toBe('<eu-id>');
      })
      .finally(() => {
        global.fetch = originalFetch;
      });
  });
});
