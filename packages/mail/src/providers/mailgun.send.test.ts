import { MailgunMailProvider } from './mailgun.provider';
import type { NormalizedMailMessage } from '../types/email-document';

const message: NormalizedMailMessage = {
  to: ['a@b.com'],
  cc: ['cc@b.com'],
  bcc: ['bcc@b.com'],
  from: 'Hazel <noreply@mg.example.com>',
  replyTo: 'support@example.com',
  subject: 'Hi',
  html: '<p>Hi</p>',
  text: 'Hi',
  headers: { 'X-Test': '1' },
  tags: { tenantId: 't1' },
  category: 'transactional',
  idempotencyKey: 'idem-mg',
  attachments: [{ filename: 'a.txt', content: 'x' }],
};

describe('MailgunMailProvider.send', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends form-encoded messages', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({ id: '<mg-1>' }),
      } as Response;
    }) as typeof fetch;

    const provider = new MailgunMailProvider({
      apiKey: 'key',
      domain: 'mg.example.com',
      from: 'fallback@mg.example.com',
      baseUrl: 'https://api.mailgun.net',
    });
    const result = await provider.send(message);
    expect(result.messageId).toBe('<mg-1>');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.example.com/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('requires from address', async () => {
    const provider = new MailgunMailProvider({ apiKey: 'key', domain: 'mg.example.com' });
    await expect(provider.send({ ...message, from: '' })).rejects.toThrow(/from address/);
  });

  it('throws on API failure', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response;
    }) as typeof fetch;

    const provider = new MailgunMailProvider({
      apiKey: 'key',
      domain: 'mg.example.com',
      webhookSecret: 'whsec',
    });
    await expect(provider.send(message)).rejects.toThrow(/Mailgun send failed/);
    expect(provider.isWebhookConfigured()).toBe(true);
    expect(await provider.health()).toBe('up');
  });

  it('parses form-urlencoded webhook payloads', () => {
    const provider = new MailgunMailProvider({
      apiKey: 'key',
      domain: 'mg.example.com',
    });
    const event = provider.parseWebhookEvent(
      'event=opened&recipient=user@example.com&timestamp=1700000000',
      {}
    );
    expect(event.type).toBe('open');
    expect(event.recipient).toBe('user@example.com');
  });
});
