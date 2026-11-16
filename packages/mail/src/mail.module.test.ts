import { MailModule, resolveMailOptions } from './mail.module';
import { MailService } from './mail.service';
import {
  MEMORY_PROVIDER_NAME,
  SES_PROVIDER_NAME,
  RESEND_PROVIDER_NAME,
  SENDGRID_PROVIDER_NAME,
  MAILGUN_PROVIDER_NAME,
} from './providers';

describe('MailModule', () => {
  afterEach(() => {
    MailService.reset();
  });

  it('forRoot registers memory by default when empty', () => {
    const mod = MailModule.forRoot({});
    expect(mod.global).toBe(true);
    expect(mod.exports).toContain(MailService);
    const mail = new MailService();
    expect(mail.getProviderNames()).toContain(MEMORY_PROVIDER_NAME);
  });

  it('forRootAsync configures from factory', async () => {
    const mod = MailModule.forRootAsync({
      useFactory: () => ({ memory: true, defaultProvider: 'memory' }),
    });
    const optionsProvider = mod.providers.find(
      (p) =>
        p.provide === 'MAIL_OPTIONS' ||
        (typeof p.provide === 'string' && p.provide === 'MAIL_OPTIONS')
    );
    expect(optionsProvider?.useFactory).toBeDefined();
    await optionsProvider!.useFactory!();
    const mail = new MailService();
    expect(mail.getProviderNames()).toContain('memory');
  });

  it('resolveMailOptions picks default provider from convenience keys', () => {
    const ses = resolveMailOptions({
      ses: { region: 'eu-west-1', accessKeyId: 'x', secretAccessKey: 'y' },
    });
    expect(ses.defaultProvider).toBe(SES_PROVIDER_NAME);

    const resend = resolveMailOptions({ resend: { apiKey: 're_test' } });
    expect(resend.defaultProvider).toBe(RESEND_PROVIDER_NAME);

    const sendgrid = resolveMailOptions({ sendgrid: { apiKey: 'SG.test' } });
    expect(sendgrid.defaultProvider).toBe(SENDGRID_PROVIDER_NAME);

    const mailgun = resolveMailOptions({
      mailgun: { apiKey: 'key', domain: 'mg.example.com' },
    });
    expect(mailgun.defaultProvider).toBe(MAILGUN_PROVIDER_NAME);
  });
});
