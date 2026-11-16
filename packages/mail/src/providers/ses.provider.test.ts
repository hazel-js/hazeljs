import { SesMailProvider } from './ses.provider';

describe('SesMailProvider.parseWebhookEvent', () => {
  const provider = new SesMailProvider({ region: 'us-east-1', webhookSecret: 'secret' });

  it('parses SNS bounce notifications', () => {
    const sns = {
      Message: JSON.stringify({
        notificationType: 'Bounce',
        mail: { messageId: 'm1' },
        bounce: {
          bouncedRecipients: [{ emailAddress: 'a@b.com', diagnosticCode: '5.1.1' }],
        },
      }),
    };
    const events = provider.parseWebhookEvent(JSON.stringify(sns), {});
    const list = Array.isArray(events) ? events : [events];
    expect(list[0].type).toBe('bounce');
    expect(list[0].recipient).toBe('a@b.com');
    expect(list[0].messageId).toBe('m1');
  });

  it('parses delivery notifications', () => {
    const payload = {
      notificationType: 'Delivery',
      mail: { messageId: 'm2' },
      delivery: { recipients: ['ok@example.com'], timestamp: '2024-01-01T00:00:00Z' },
    };
    const event = provider.parseWebhookEvent(JSON.stringify(payload), {});
    const single = Array.isArray(event) ? event[0] : event;
    expect(single.type).toBe('delivery');
    expect(single.recipient).toBe('ok@example.com');
  });
});
