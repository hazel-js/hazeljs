# @hazeljs/mail

**Structured, provider-agnostic email for HazelJS.** Compose emails as documents, apply delivery policy, then send through SMTP, SES, Resend, SendGrid, Mailgun, or your own provider.

[![npm version](https://img.shields.io/npm/v/@hazeljs/mail.svg)](https://www.npmjs.com/package/@hazeljs/mail)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/mail)](https://www.npmjs.com/package/@hazeljs/mail)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **EmailDocument + Compose API** — Layouts, sections, CTAs, ICS calendar parts, List-Unsubscribe, tags, and brand themes as structured TypeScript
- **Delivery policy** — Suppress, staging intercept, quiet hours, rate limits, and address validation before send
- **Multi-provider send** — `memory`, `log`, `smtp`, `ses`, `resend`, `sendgrid`, `mailgun` with retry and failover
- **Typed mailables** — Zod-validated mail classes + discoverable `MailCatalog`
- **File templates** — Optional Handlebars adapter (`template: { dir }`)
- **Lifecycle webhooks** — `POST /mail/webhook/:provider` for bounce / complaint / delivery / open / click
- **Queue integration** — Optional `sendLater()` via `@hazeljs/queue`

## Installation

```bash
npm install @hazeljs/mail
```

Optional peers:

```bash
npm install nodemailer          # SMTP provider
npm install handlebars          # File templates
npm install @hazeljs/queue      # sendLater()
npm install @hazeljs/event-emitter
```

## Quick Start

### 1. Register the module

```typescript
import { HazelApp } from '@hazeljs/core';
import { MailModule } from '@hazeljs/mail';

const app = new HazelApp({
  modules: [
    MailModule.forRoot({
      memory: true, // zero-network for local / tests
      defaults: { from: 'Hazel <noreply@hazeljs.ai>' },
      brand: {
        name: 'Hazel',
        colors: { primary: '#0F766E' },
        footer: 'Sent by HazelJS',
      },
      policy: {
        intercept: {
          enabled: process.env.NODE_ENV !== 'production',
          to: 'qa@hazeljs.ai',
        },
      },
    }),
  ],
});
```

### 2. Compose and send

```typescript
import { MailService, email } from '@hazeljs/mail';

const doc = email()
  .category('transactional')
  .subject(`Welcome, ${user.name}`)
  .to(user.email)
  .section({ heading: 'Welcome', body: 'Glad you are here.' })
  .cta({ label: 'Open dashboard', href: 'https://app.example.com' })
  .unsubscribe({ url: 'https://app.example.com/unsub' })
  .build();

const result = await mailService.send(doc);
// result.status: 'sent' | 'queued' | 'suppressed' | 'intercepted' | 'deferred'
```

### 3. Production providers

```typescript
MailModule.forRoot({
  defaultProvider: 'ses',
  failover: ['sendgrid', 'mailgun', 'resend'],
  defaults: { from: 'Hazel <noreply@hazeljs.ai>' },
  ses: { region: process.env.AWS_REGION ?? 'eu-west-1' },
  sendgrid: { apiKey: process.env.SENDGRID_API_KEY! },
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY!,
    domain: 'mg.example.com',
    region: 'eu',
  },
  resend: { apiKey: process.env.RESEND_API_KEY! },
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  },
});
```

## Providers

| Provider   | Config key  | Notes                                                                  |
| ---------- | ----------- | ---------------------------------------------------------------------- |
| `memory`   | `memory`    | Assertable in-memory mailbox for tests                                 |
| `log`      | `log`       | Logs rendered mail to the console                                      |
| `smtp`     | `smtp`      | Requires `nodemailer` peer                                             |
| `ses`      | `ses`       | Amazon SES v2 via SigV4 fetch (no AWS SDK)                             |
| `resend`   | `resend`    | Resend HTTP API + webhook signature verify                             |
| `sendgrid` | `sendgrid`  | SendGrid v3 Mail Send; EU via `baseUrl: 'https://api.eu.sendgrid.com'` |
| `mailgun`  | `mailgun`   | Mailgun Messages API; `region: 'us' \| 'eu'`                           |
| custom     | `providers` | Implement `MailProvider` and register by name                          |

Use a specific provider per send:

```typescript
await mailService.send(
  email().subject('Hi').to(user.email).provider('sendgrid').section({ body: '…' }).build()
);
```

Provider-specific APIs:

```typescript
import { MailService, MemoryMailProvider, MEMORY_PROVIDER_NAME } from '@hazeljs/mail';

const memory = mailService.getProvider<MemoryMailProvider>(MEMORY_PROVIDER_NAME);
expect(memory.mailbox).toHaveLength(1);
```

## Typed mailables

```typescript
import { z } from 'zod';
import { defineMailable, globalMailCatalog } from '@hazeljs/mail';

const WelcomeMail = defineMailable({
  name: 'welcome',
  schema: z.object({ name: z.string() }),
  build: (data, { email }) =>
    email()
      .subject(`Welcome, ${data.name}`)
      .to('placeholder@example.com')
      .section({ body: `Hi ${data.name}` })
      .build(),
});

globalMailCatalog.register(WelcomeMail);

await mailService.sendMailable(WelcomeMail, {
  to: user.email,
  data: { name: user.name },
});
```

## File templates

```typescript
MailModule.forRoot({
  template: { dir: './emails', engine: 'handlebars' },
  ses: { region: 'us-east-1' },
});

await mailService.sendTemplate('welcome', {
  to: user.email,
  context: { name: user.name },
  subject: 'Welcome', // optional override
});
```

Looks for `welcome.hbs` (HTML), optional `welcome.subject.hbs` and `welcome.text.hbs`.

## Delivery policy

```typescript
MailModule.forRoot({
  memory: true,
  policy: {
    validate: true,
    intercept: {
      enabled: process.env.NODE_ENV !== 'production',
      to: 'qa@example.com',
      subjectPrefix: '[INTERCEPTED] ',
    },
    suppress: async (address) => denylist.has(address),
    quietHours: { category: 'marketing', start: 22, end: 8 },
    rateLimit: { maxMessages: 100, periodMs: 60_000 },
  },
});
```

## Webhooks

The controller exposes **POST /mail/webhook/:provider** (e.g. `POST /mail/webhook/ses`). Prefer the **raw request body** for signature verification.

Normalized lifecycle events: bounce, complaint, delivery, open, click (SES SNS, Resend, SendGrid event arrays, Mailgun `event-data`).

```typescript
const event = mailService.parseWebhookEvent('ses', req.rawBody, headers);
// emits mail.bounced | mail.complained | mail.delivered | mail.opened | mail.clicked
```

Pass an event emitter in `forRoot` to receive outbound events (`mail.sent`, `mail.failed`, `mail.suppressed`, `mail.intercepted`, `mail.queued`, `mail.deferred`) as well.

## Queue

```typescript
import { QueueModule, QueueService } from '@hazeljs/queue';
import { MailModule } from '@hazeljs/mail';

MailModule.forRoot({
  ses: { region: 'eu-west-1' },
  queue: { enabled: true, name: 'mail', jobName: 'send' },
  queueClient: queueService, // from @hazeljs/queue
});

await mailService.sendLater(doc);
```

Process jobs with a BullMQ worker that calls `mailService.send(job.data.document)`.

## Async configuration

```typescript
MailModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    defaultProvider: 'resend',
    resend: { apiKey: config.get('RESEND_API_KEY') },
    defaults: { from: config.get('MAIL_FROM') },
  }),
  inject: [ConfigService],
});
```

## Adding a new provider

Implement `MailProvider` and register it in `forRoot({ providers: { name: instance } })`:

```typescript
import type { MailProvider, NormalizedMailMessage, ProviderSendResult } from '@hazeljs/mail';

export class MyMailProvider implements MailProvider {
  readonly name = 'mygateway';

  async send(message: NormalizedMailMessage): Promise<ProviderSendResult> {
    // Call your API; return { messageId, provider: this.name, accepted: message.to }
  }

  async health(): Promise<'up' | 'down'> {
    return 'up';
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  parseWebhookEvent(payload: string | Buffer, headers: Record<string, string>) {
    // Verify signature and return a MailLifecycleEvent (or array).
  }
}

MailModule.forRoot({
  defaultProvider: 'mygateway',
  providers: { mygateway: new MyMailProvider(config) },
});
```

## API summary

| Method                                          | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `send(document)`                                | Render, apply policy, send via provider               |
| `sendLater(document)`                           | Enqueue when queue is enabled; otherwise `send()`     |
| `sendTemplate(name, options)`                   | Render Handlebars template then send                  |
| `sendMailable(mailable, options)`               | Render typed mailable then send                       |
| `normalize(document)`                           | Build `NormalizedMailMessage` (HTML/text/headers)     |
| `parseWebhookEvent(provider, payload, headers)` | Verify/parse lifecycle webhook; emits `mail.*` events |
| `getProvider(name)`                             | Get provider instance                                 |
| `getProviderNames()`                            | List registered provider names                        |
| `getCatalog()`                                  | Access the `MailCatalog`                              |

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)
