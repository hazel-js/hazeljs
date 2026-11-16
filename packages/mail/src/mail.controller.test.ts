import { MailModule } from './mail.module';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { SesMailProvider } from './providers/ses.provider';

describe('MailController', () => {
  afterEach(() => {
    MailService.reset();
  });

  it('handles provider webhooks', async () => {
    MailModule.forRoot({
      providers: {
        ses: new SesMailProvider({ region: 'us-east-1', webhookSecret: 'x' }),
      },
      defaultProvider: 'ses',
    });
    const controller = new MailController(new MailService());

    const res = {
      statusCode: 0,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };

    const payload = JSON.stringify({
      notificationType: 'Bounce',
      mail: { messageId: 'm1' },
      bounce: { bouncedRecipients: [{ emailAddress: 'a@b.com' }] },
    });

    await controller.webhook(
      'ses',
      { headers: {}, rawBody: payload, body: payload } as never,
      res as never
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, provider: 'ses' });
  });
});
