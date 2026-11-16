import { z } from 'zod';
import { email } from './compose/compose';
import { defineMailable, globalMailCatalog } from './compose/mailables';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';
import { MemoryMailProvider } from './providers/memory.provider';
import { MAIL_SENT, MAIL_SUPPRESSED } from './events/mail.events';

describe('MailService', () => {
  afterEach(() => {
    MailService.reset();
  });

  it('sends via memory provider and records mailbox', async () => {
    const events: string[] = [];
    MailModule.forRoot({
      memory: true,
      defaults: { from: 'Hazel <noreply@hazeljs.ai>' },
      eventEmitter: {
        emit: (event) => {
          events.push(String(event));
          return true;
        },
      },
    });

    const mail = new MailService();
    const doc = email()
      .subject('Welcome')
      .to('ada@example.com')
      .section({ heading: 'Hello', body: 'Welcome aboard.' })
      .cta({ label: 'Dashboard', href: 'https://hazeljs.ai' })
      .build();

    const result = await mail.send(doc);
    expect(result.status).toBe('sent');
    expect(result.provider).toBe('memory');
    expect(events).toContain(MAIL_SENT);

    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.mailbox).toHaveLength(1);
    expect(memory.latest()?.message.subject).toBe('Welcome');
    expect(memory.latest()?.message.html).toContain('Welcome aboard');
  });

  it('suppresses recipients via policy', async () => {
    const events: string[] = [];
    MailModule.forRoot({
      memory: true,
      policy: {
        suppress: async (addr) => addr === 'blocked@example.com',
      },
      eventEmitter: {
        emit: (event) => {
          events.push(String(event));
          return true;
        },
      },
    });

    const mail = new MailService();
    const result = await mail.send(
      email().subject('Nope').to('blocked@example.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('suppressed');
    expect(events).toContain(MAIL_SUPPRESSED);
  });

  it('intercepts recipients', async () => {
    MailModule.forRoot({
      memory: true,
      policy: {
        intercept: { enabled: true, to: 'qa@example.com', subjectPrefix: '[QA] ' },
      },
    });
    const mail = new MailService();
    const result = await mail.send(
      email().subject('Launch').to('user@example.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('intercepted');
    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.latest()?.message.to).toEqual(['qa@example.com']);
    expect(memory.latest()?.message.subject).toBe('[QA] Launch');
  });

  it('sends typed mailables', async () => {
    MailModule.forRoot({ memory: true, defaults: { from: 'noreply@hazeljs.ai' } });
    const WelcomeMail = defineMailable({
      name: 'welcome',
      schema: z.object({ name: z.string() }),
      build: (data, { email: e }) =>
        e()
          .subject(`Welcome, ${data.name}`)
          .to('placeholder@example.com')
          .section({ body: `Hi ${data.name}` })
          .build(),
    });
    globalMailCatalog.register(WelcomeMail);

    const mail = new MailService();
    const result = await mail.sendMailable(WelcomeMail, {
      to: 'ada@example.com',
      data: { name: 'Ada' },
    });
    expect(result.status).toBe('sent');
    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.latest()?.message.subject).toBe('Welcome, Ada');
    expect(memory.latest()?.message.to).toEqual(['ada@example.com']);
  });

  it('normalizes ICS and unsubscribe headers', async () => {
    MailModule.forRoot({
      memory: true,
      defaults: { from: 'noreply@hazeljs.ai' },
      brand: { name: 'Hazel', footer: 'Footer' },
    });
    const mail = new MailService();
    const result = await mail.send(
      email()
        .subject('Meet')
        .to('a@b.com')
        .section({ body: 'See you' })
        .unsubscribe({
          url: 'https://example.com/unsub',
          oneClickUrl: 'https://example.com/one-click',
        })
        .ics({
          uid: '1',
          summary: 'Sync',
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T11:00:00Z'),
        })
        .build()
    );
    expect(result.status).toBe('sent');
    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.latest()?.message.headers['List-Unsubscribe']).toContain(
      'https://example.com/unsub'
    );
    expect(memory.latest()?.message.attachments?.[0]?.filename).toBe('invite.ics');
  });

  it('defers during quiet hours', async () => {
    const hour = new Date().getHours();
    const end = (hour + 1) % 24;
    MailModule.forRoot({
      memory: true,
      policy: {
        quietHours: { category: 'marketing', start: hour, end },
      },
    });
    const mail = new MailService();
    const result = await mail.send(
      email().category('marketing').subject('Sale').to('a@b.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('deferred');
  });

  it('queues with sendLater when queueClient is configured', async () => {
    const added: unknown[] = [];
    MailModule.forRoot({
      memory: true,
      queue: { enabled: true, name: 'mail', jobName: 'send' },
      queueClient: {
        add: async (queueName, jobName, data) => {
          added.push({ queueName, jobName, data });
          return { id: 'job-1' };
        },
      },
    });
    const mail = new MailService();
    const result = await mail.sendLater(
      email().subject('Queued').to('a@b.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('queued');
    expect(added).toHaveLength(1);
  });
});
