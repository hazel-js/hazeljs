import { createHmac } from 'crypto';
import { ResendMailProvider } from './resend.provider';

describe('ResendMailProvider.parseWebhookEvent', () => {
  it('normalizes delivered events', () => {
    const provider = new ResendMailProvider({ apiKey: 're_test' });
    const event = provider.parseWebhookEvent(
      JSON.stringify({
        type: 'email.delivered',
        data: { email_id: 'abc', to: ['user@example.com'], created_at: '2024-01-01' },
      }),
      {}
    );
    expect(event.type).toBe('delivery');
    expect(event.messageId).toBe('abc');
    expect(event.recipient).toBe('user@example.com');
  });

  it('verifies webhook signatures when configured', () => {
    const secret = 'whsec_test';
    const provider = new ResendMailProvider({ apiKey: 're_test', webhookSecret: secret });
    const payload = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'x', to: 'a@b.com' },
    });
    const timestamp = '123';
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    const event = provider.parseWebhookEvent(payload, {
      'resend-signature': `v1=${signature}`,
      'resend-timestamp': timestamp,
    });
    expect(event.type).toBe('bounce');
  });
});
