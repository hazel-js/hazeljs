import { HazelModule } from '@hazeljs/core';
import { resolveBrands } from './compose/brand';
import { globalMailCatalog } from './compose/mailables';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { DeliveryPolicy } from './policy/delivery-policy';
import {
  LogMailProvider,
  LOG_PROVIDER_NAME,
  MailgunMailProvider,
  MAILGUN_PROVIDER_NAME,
  MemoryMailProvider,
  MEMORY_PROVIDER_NAME,
  ResendMailProvider,
  RESEND_PROVIDER_NAME,
  SendGridMailProvider,
  SENDGRID_PROVIDER_NAME,
  SesMailProvider,
  SES_PROVIDER_NAME,
  SmtpMailProvider,
  SMTP_PROVIDER_NAME,
  type MailProvider,
} from './providers';
import { HandlebarsAdapter } from './render/handlebars.adapter';
import { MAIL_OPTIONS_TOKEN } from './tokens';
import type {
  MailModuleAsyncOptions,
  MailModuleOptions,
  ResolvedMailModuleOptions,
} from './types/module.types';

function buildProviders(options: MailModuleOptions): Record<string, MailProvider> {
  const providers: Record<string, MailProvider> = {
    ...(options.providers ?? {}),
  };

  if (options.memory) {
    const name =
      typeof options.memory === 'object' && options.memory.name
        ? options.memory.name
        : MEMORY_PROVIDER_NAME;
    providers[name] = new MemoryMailProvider(name);
  }

  if (options.log) {
    const name =
      typeof options.log === 'object' && options.log.name ? options.log.name : LOG_PROVIDER_NAME;
    providers[name] = new LogMailProvider(name);
  }

  if (options.smtp) {
    providers[SMTP_PROVIDER_NAME] = new SmtpMailProvider(options.smtp);
  }
  if (options.ses) {
    providers[SES_PROVIDER_NAME] = new SesMailProvider(options.ses);
  }
  if (options.resend) {
    providers[RESEND_PROVIDER_NAME] = new ResendMailProvider(options.resend);
  }
  if (options.sendgrid) {
    providers[SENDGRID_PROVIDER_NAME] = new SendGridMailProvider(options.sendgrid);
  }
  if (options.mailgun) {
    providers[MAILGUN_PROVIDER_NAME] = new MailgunMailProvider(options.mailgun);
  }

  // Sensible local default when nothing registered
  if (Object.keys(providers).length === 0) {
    providers[MEMORY_PROVIDER_NAME] = new MemoryMailProvider();
  }

  return providers;
}

function pickDefaultProvider(
  options: MailModuleOptions,
  providers: Record<string, MailProvider>
): string {
  if (options.defaultProvider) {
    return options.defaultProvider;
  }
  if (options.ses) return SES_PROVIDER_NAME;
  if (options.resend) return RESEND_PROVIDER_NAME;
  if (options.sendgrid) return SENDGRID_PROVIDER_NAME;
  if (options.mailgun) return MAILGUN_PROVIDER_NAME;
  if (options.smtp) return SMTP_PROVIDER_NAME;
  return Object.keys(providers)[0];
}

export function resolveMailOptions(options: MailModuleOptions): ResolvedMailModuleOptions {
  const providers = buildProviders(options);
  return {
    defaultProvider: pickDefaultProvider(options, providers),
    defaults: options.defaults ?? {},
    brands: resolveBrands(options.brand),
    policy: options.policy ?? { validate: true },
    template: options.template,
    queue: {
      enabled: options.queue?.enabled ?? false,
      name: options.queue?.name ?? 'mail',
      jobName: options.queue?.jobName ?? 'send',
    },
    retry:
      options.retry === false ? false : (options.retry ?? { attempts: 3, backoff: 'exponential' }),
    failover: options.failover ?? [],
    providers,
    isGlobal: options.isGlobal ?? true,
    eventEmitter: options.eventEmitter,
  };
}

function configureRuntime(
  resolved: ResolvedMailModuleOptions,
  queueClient?: import('./queue/mail.queue').MailQueueClient
): void {
  MailService.configure({
    options: resolved,
    policy: new DeliveryPolicy(resolved.policy),
    templateAdapter: resolved.template ? new HandlebarsAdapter(resolved.template) : undefined,
    catalog: globalMailCatalog,
    queue: queueClient,
  });
}

@HazelModule({
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {
  /**
   * Configure mail providers, policy, templates, and optional queue/events.
   */
  static forRoot(options: MailModuleOptions = {}): {
    module: typeof MailModule;
    providers: Array<{
      provide: string | typeof MailService;
      useValue?: unknown;
      useFactory?: (...args: unknown[]) => unknown;
      inject?: string[];
    }>;
    exports: Array<typeof MailService | string>;
    global: boolean;
  } {
    const resolved = resolveMailOptions(options);
    configureRuntime(resolved, options.queueClient);

    return {
      module: MailModule,
      providers: [
        { provide: MAIL_OPTIONS_TOKEN, useValue: resolved },
        {
          provide: MailService,
          useFactory: () => new MailService(),
        },
      ],
      exports: [MailService, MAIL_OPTIONS_TOKEN],
      global: resolved.isGlobal,
    };
  }

  /**
   * Async configuration (e.g. from ConfigService).
   */
  static forRootAsync(asyncOptions: MailModuleAsyncOptions): {
    module: typeof MailModule;
    providers: Array<{
      provide: string | typeof MailService;
      useFactory?: (...args: unknown[]) => unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof MailService | string>;
    global: boolean;
  } {
    return {
      module: MailModule,
      providers: [
        {
          provide: MAIL_OPTIONS_TOKEN,
          useFactory: async (...args: unknown[]): Promise<ResolvedMailModuleOptions> => {
            const options = await asyncOptions.useFactory(...args);
            const resolved = resolveMailOptions(options);
            configureRuntime(resolved, options.queueClient);
            return resolved;
          },
          inject: asyncOptions.inject ?? [],
        },
        {
          provide: MailService,
          useFactory: () => new MailService(),
          inject: [MAIL_OPTIONS_TOKEN],
        },
      ],
      exports: [MailService, MAIL_OPTIONS_TOKEN],
      global: asyncOptions.isGlobal ?? true,
    };
  }
}
