jest.mock(
  'nodemailer',
  () => ({
    createTransport: () => ({
      sendMail: jest.fn(async () => ({
        messageId: 'smtp-1',
        accepted: ['a@b.com'],
        rejected: [],
      })),
      verify: jest.fn(async () => true),
    }),
  }),
  { virtual: true }
);

import { SmtpMailProvider } from './smtp.provider';

describe('SmtpMailProvider', () => {
  it('sends via nodemailer transport', async () => {
    const provider = new SmtpMailProvider({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'u', pass: 'p' },
      from: 'noreply@example.com',
    });

    const result = await provider.send({
      to: ['a@b.com'],
      cc: ['cc@b.com'],
      from: 'Hazel <noreply@example.com>',
      replyTo: 'support@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: {},
      category: 'transactional',
      idempotencyKey: 'idem-smtp',
      metadata: { icsContent: 'BEGIN:VCALENDAR\nEND:VCALENDAR' },
      attachments: [{ filename: 'a.txt', content: 'x', contentType: 'text/plain' }],
    });

    expect(result.messageId).toBe('smtp-1');
    expect(await provider.health()).toBe('up');
  });
});
