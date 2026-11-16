import { createHmac } from 'crypto';
import { SendGridMailProvider } from './sendgrid.provider';

describe('SendGridMailProvider', () => {
  it('parses event webhook arrays', () => {
    const provider = new SendGridMailProvider({ apiKey: 'SG.test' });
    const events = provider.parseWebhookEvent(
      JSON.stringify([
        {
          email: 'user@example.com',
          event: 'bounce',
          reason: '550',
          sg_message_id: 'abc.filter',
          timestamp: 1700000000,
        },
        {
          email: 'user@example.com',
          event: 'click',
          url: 'https://example.com',
          sg_message_id: 'abc.filter',
          timestamp: 1700000001,
        },
      ]),
      {}
    );
    const list = Array.isArray(events) ? events : [events];
    expect(list[0].type).toBe('bounce');
    expect(list[0].recipient).toBe('user@example.com');
    expect(list[1].type).toBe('click');
    expect(list[1].url).toBe('https://example.com');
  });

  it('verifies optional HMAC webhook signatures', () => {
    const secret = 'sg_secret';
    const provider = new SendGridMailProvider({ apiKey: 'SG.test', webhookSecret: secret });
    const payload = JSON.stringify([{ email: 'a@b.com', event: 'delivered', timestamp: 1 }]);
    const timestamp = '1700000000';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}${payload}`)
      .digest('base64');
    const events = provider.parseWebhookEvent(payload, {
      'x-twilio-email-event-webhook-signature': signature,
      'x-twilio-email-event-webhook-timestamp': timestamp,
    });
    const list = Array.isArray(events) ? events : [events];
    expect(list[0].type).toBe('delivery');
  });
});
