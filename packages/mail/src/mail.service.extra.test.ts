jest.mock(
  'handlebars',
  () => ({
    compile: (src: string) => (ctx: Record<string, unknown>) =>
      src.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(ctx[key] ?? '')),
  }),
  { virtual: true }
);

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { z } from 'zod';
import { email } from './compose/compose';
import { defineMailable, globalMailCatalog } from './compose/mailables';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';
import { MemoryMailProvider } from './providers/memory.provider';
import { MAIL_FAILED } from './events/mail.events';

describe('MailService extra coverage', () => {
  afterEach(() => {
    MailService.reset();
  });

  it('exposes catalog and provider helpers', () => {
    MailModule.forRoot({ memory: true });
    const mail = new MailService();
    expect(mail.getCatalog()).toBe(globalMailCatalog);
    expect(mail.getProviderNames()).toContain('memory');
    expect(() => mail.getProvider('missing')).toThrow(/not found/);
  });

  it('sendMailable resolves by catalog name', async () => {
    MailModule.forRoot({ memory: true, defaults: { from: 'noreply@hazeljs.ai' } });
    const Hello = defineMailable({
      name: 'hello-extra',
      schema: z.object({ name: z.string() }),
      build: (data, { email: e }) =>
        e().subject(`Hi ${data.name}`).to('x@y.com').section({ body: data.name }).build(),
    });
    globalMailCatalog.register(Hello);

    const mail = new MailService();
    const result = await mail.sendMailable('hello-extra', {
      to: 'ada@example.com',
      data: { name: 'Ada' },
    });
    expect(result.status).toBe('sent');
  });

  it('sendMailable throws for unknown catalog name', async () => {
    MailModule.forRoot({ memory: true });
    const mail = new MailService();
    await expect(mail.sendMailable('does-not-exist', { to: 'a@b.com', data: {} })).rejects.toThrow(
      /Unknown mailable/
    );
  });

  it('sendTemplate throws when templates are not configured', async () => {
    MailModule.forRoot({ memory: true });
    const mail = new MailService();
    await expect(
      mail.sendTemplate('welcome', { to: 'a@b.com', context: { name: 'Ada' } })
    ).rejects.toThrow(/Template engine not configured/);
  });

  it('sendTemplate renders via Handlebars when configured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hazel-mail-svc-'));
    writeFileSync(join(dir, 'welcome.hbs'), '<p>Hello {{name}}</p>');
    writeFileSync(join(dir, 'welcome.subject.hbs'), 'Hi {{name}}');

    try {
      MailModule.forRoot({
        memory: true,
        defaults: { from: 'noreply@hazeljs.ai' },
        template: { dir },
      });
      const mail = new MailService();
      const result = await mail.sendTemplate('welcome', {
        to: 'ada@example.com',
        context: { name: 'Ada' },
        cc: 'cc@example.com',
        bcc: ['bcc@example.com'],
        locale: 'en',
        tags: { env: 'test' },
        idempotencyKey: 't1',
        correlationId: 'c1',
        provider: 'memory',
      });
      expect(result.status).toBe('sent');
      const memory = mail.getProvider<MemoryMailProvider>('memory');
      expect(memory.latest()?.message.html).toContain('Hello Ada');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sendLater falls back to send without queue', async () => {
    MailModule.forRoot({ memory: true, defaults: { from: 'noreply@hazeljs.ai' } });
    const mail = new MailService();
    const result = await mail.sendLater(
      email().subject('Direct').to('a@b.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('sent');
  });

  it('emits mail.failed when provider send fails', async () => {
    const events: string[] = [];
    const failing = {
      name: 'failing',
      send: async () => {
        throw new Error('boom');
      },
    };
    MailModule.forRoot({
      defaultProvider: 'failing',
      providers: { failing },
      retry: false,
      eventEmitter: {
        emit: (event) => {
          events.push(String(event));
          return true;
        },
      },
    });
    const mail = new MailService();
    await expect(
      mail.send(email().subject('Fail').to('a@b.com').section({ body: 'x' }).build())
    ).rejects.toThrow('boom');
    expect(events).toContain(MAIL_FAILED);
  });

  it('allows intercept allow-list recipients through', async () => {
    MailModule.forRoot({
      memory: true,
      defaults: { from: 'noreply@hazeljs.ai' },
      policy: {
        intercept: {
          enabled: true,
          to: 'qa@example.com',
          allow: async (addr) => addr === 'vip@example.com',
        },
      },
    });
    const mail = new MailService();
    const result = await mail.send(
      email().subject('VIP').to('vip@example.com').section({ body: 'x' }).build()
    );
    expect(result.status).toBe('sent');
    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.latest()?.message.to).toEqual(['vip@example.com']);
  });

  it('uses named brand when resolving', async () => {
    MailModule.forRoot({
      memory: true,
      defaults: { from: 'noreply@hazeljs.ai' },
      brand: {
        default: { name: 'Default' },
        acme: { name: 'Acme', footer: 'Acme Inc' },
      },
    });
    const mail = new MailService();
    await mail.send(
      email().subject('Brand').to('a@b.com').brand('acme').section({ body: 'x' }).build()
    );
    const memory = mail.getProvider<MemoryMailProvider>('memory');
    expect(memory.latest()?.message.html).toContain('Acme');
  });
});
