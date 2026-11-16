import { ResendMailProvider } from './resend.provider';

describe('ResendMailProvider.send', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts emails to Resend', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({ id: 're_123' }),
      } as Response;
    }) as typeof fetch;

    const provider = new ResendMailProvider({
      apiKey: 're_test',
      from: 'noreply@hazeljs.ai',
    });
    const result = await provider.send({
      to: ['a@b.com'],
      cc: ['cc@b.com'],
      from: 'Hazel <noreply@hazeljs.ai>',
      replyTo: 'support@hazeljs.ai',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'X-Test': '1' },
      tags: { env: 'test' },
      category: 'transactional',
      idempotencyKey: 'idem-re',
      attachments: [{ filename: 'a.txt', content: Buffer.from('hi') }],
    });
    expect(result.messageId).toBe('re_123');
    expect(await provider.health()).toBe('up');
    expect(provider.isWebhookConfigured()).toBe(false);
  });

  it('throws on API errors', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limited' }),
      } as Response;
    }) as typeof fetch;

    const provider = new ResendMailProvider({ apiKey: 're_test', webhookSecret: 'sec' });
    await expect(
      provider.send({
        to: ['a@b.com'],
        from: 'a@b.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        text: 'Hi',
        headers: {},
        category: 'transactional',
      })
    ).rejects.toThrow(/Resend send failed/);
    expect(provider.isWebhookConfigured()).toBe(true);
  });
});
