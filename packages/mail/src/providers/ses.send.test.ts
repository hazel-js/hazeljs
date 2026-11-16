import { SesMailProvider } from './ses.provider';

describe('SesMailProvider.send', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('sends signed requests when credentials are present', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';

    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({ MessageId: 'ses-1' }),
      } as Response;
    }) as typeof fetch;

    const provider = new SesMailProvider({
      region: 'us-east-1',
      from: 'noreply@hazeljs.ai',
      configurationSetName: 'default',
      webhookSecret: 'x',
    });

    const result = await provider.send({
      to: ['a@b.com'],
      cc: ['cc@b.com'],
      from: 'Hazel <noreply@hazeljs.ai>',
      replyTo: 'support@hazeljs.ai',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: {},
      tags: { env: 'test' },
      category: 'transactional',
    });

    expect(result.messageId).toBe('ses-1');
    expect(await provider.health()).toBe('up');
    expect(provider.isWebhookConfigured()).toBe(true);
  });

  it('throws when credentials are missing', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    const provider = new SesMailProvider({ region: 'us-east-1' });
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
    ).rejects.toThrow(/credentials missing/i);
  });

  it('throws on SES API errors', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ message: 'fail' }),
      } as Response;
    }) as typeof fetch;

    const provider = new SesMailProvider({ region: 'eu-west-1', from: 'a@b.com' });
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
    ).rejects.toThrow(/SES send failed/);
  });
});
