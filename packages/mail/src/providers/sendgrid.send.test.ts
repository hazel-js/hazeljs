import { SendGridMailProvider } from './sendgrid.provider';
import type { NormalizedMailMessage } from '../types/email-document';

const baseMessage: NormalizedMailMessage = {
  to: ['Ada Lovelace <ada@example.com>'],
  cc: ['cc@example.com'],
  bcc: ['bcc@example.com'],
  from: 'Hazel <noreply@hazeljs.ai>',
  replyTo: 'support@hazeljs.ai',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
  headers: { 'X-Custom': '1' },
  tags: { campaign: 'welcome' },
  category: 'transactional',
  idempotencyKey: 'idem-sg',
  attachments: [
    { filename: 'note.txt', content: 'hello', contentType: 'text/plain', cid: 'c1' },
    { filename: 'bin.bin', content: Buffer.from('abc'), contentType: 'application/octet-stream' },
  ],
};

describe('SendGridMailProvider.send', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts to the v3 mail send API', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        status: 202,
        text: async () => '',
        headers: { get: (name: string) => (name === 'x-message-id' ? 'sg-msg-1' : null) },
      } as unknown as Response;
    }) as typeof fetch;

    const provider = new SendGridMailProvider({
      apiKey: 'SG.test',
      from: 'fallback@hazeljs.ai',
    });
    const result = await provider.send(baseMessage);
    expect(result.messageId).toBe('sg-msg-1');
    expect(result.provider).toBe('sendgrid');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' })
    );
    expect(await provider.health()).toBe('up');
    expect(provider.isWebhookConfigured()).toBe(false);
  });

  it('throws when from is missing', async () => {
    const provider = new SendGridMailProvider({ apiKey: 'SG.test' });
    await expect(
      provider.send({ ...baseMessage, from: '' })
    ).rejects.toThrow(/from address/);
  });

  it('throws on API errors and parses non-json bodies', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 400,
        text: async () => 'not-json',
        headers: { get: () => null },
      } as unknown as Response;
    }) as typeof fetch;

    const provider = new SendGridMailProvider({ apiKey: 'SG.test', from: 'a@b.com' });
    await expect(provider.send({ ...baseMessage, from: 'a@b.com', idempotencyKey: undefined })).rejects.toThrow(
      /SendGrid send failed/
    );
  });

  it('uses EU baseUrl when configured', async () => {
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('api.eu.sendgrid.com');
      return {
        ok: true,
        status: 202,
        text: async () => '{"ok":true}',
        headers: { get: () => null },
      } as unknown as Response;
    }) as typeof fetch;

    const provider = new SendGridMailProvider({
      apiKey: 'SG.test',
      baseUrl: 'https://api.eu.sendgrid.com',
      from: 'a@b.com',
      webhookSecret: 'sec',
    });
    const result = await provider.send({ ...baseMessage, from: 'a@b.com', idempotencyKey: undefined });
    expect(result.messageId).toMatch(/^sendgrid-/);
    expect(provider.isWebhookConfigured()).toBe(true);
  });
});
