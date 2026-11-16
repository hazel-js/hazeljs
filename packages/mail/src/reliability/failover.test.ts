import type { MailProvider } from '../providers/provider.interface';
import type { NormalizedMailMessage } from '../types/email-document';
import { sendWithFailover } from './failover';

const message: NormalizedMailMessage = {
  to: ['a@b.com'],
  from: 'x@y.com',
  subject: 'Hi',
  html: '<p>Hi</p>',
  text: 'Hi',
  headers: {},
  category: 'transactional',
};

describe('sendWithFailover', () => {
  it('falls over to the next provider', async () => {
    const primary: MailProvider = {
      name: 'primary',
      send: async () => {
        throw Object.assign(new Error('down'), { status: 503 });
      },
    };
    const secondary: MailProvider = {
      name: 'secondary',
      send: async () => ({ messageId: 'ok', provider: 'secondary' }),
    };

    const result = await sendWithFailover(
      { primary, secondary },
      'primary',
      ['secondary'],
      message,
      { attempts: 1, delayMs: 1 }
    );
    expect(result.provider).toBe('secondary');
  });
});
