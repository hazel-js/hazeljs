import { MailModule } from './mail.module';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { SesMailProvider } from './providers/ses.provider';

function mockRes() {
  return {
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
}

describe('MailController edge cases', () => {
  afterEach(() => {
    MailService.reset();
  });

  it('returns 400 when raw body is missing', async () => {
    MailModule.forRoot({
      providers: { ses: new SesMailProvider({ region: 'us-east-1' }) },
      defaultProvider: 'ses',
    });
    const controller = new MailController(new MailService());
    const res = mockRes();
    await controller.webhook('ses', { headers: { 'x-test': '1' } } as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Webhook requires raw body' });
  });

  it('normalizes array headers and string body', async () => {
    MailModule.forRoot({
      providers: { ses: new SesMailProvider({ region: 'us-east-1' }) },
      defaultProvider: 'ses',
    });
    const controller = new MailController(new MailService());
    const res = mockRes();
    const payload = JSON.stringify({
      notificationType: 'Delivery',
      mail: { messageId: 'm1' },
      delivery: { recipients: ['a@b.com'] },
    });
    await controller.webhook(
      'ses',
      {
        headers: { 'X-Array': ['one', 'two'], plain: 'yes' },
        body: payload,
      } as never,
      res as never
    );
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when provider parsing fails', async () => {
    MailModule.forRoot({
      providers: { ses: new SesMailProvider({ region: 'us-east-1' }) },
      defaultProvider: 'ses',
    });
    const controller = new MailController(new MailService());
    const res = mockRes();
    await controller.webhook(
      'ses',
      { headers: {}, body: 'not-json', rawBody: 'not-json' } as never,
      res as never
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBeTruthy();
  });

  it('stringifies object body when rawBody is absent', async () => {
    MailModule.forRoot({
      providers: { ses: new SesMailProvider({ region: 'us-east-1' }) },
      defaultProvider: 'ses',
    });
    const controller = new MailController(new MailService());
    const res = mockRes();
    await controller.webhook(
      'ses',
      {
        headers: {},
        body: {
          notificationType: 'Complaint',
          mail: { messageId: 'c1' },
          complaint: { complainedRecipients: [{ emailAddress: 'x@y.com' }] },
        },
      } as never,
      res as never
    );
    expect(res.statusCode).toBe(200);
  });
});
