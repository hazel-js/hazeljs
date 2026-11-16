export { MailModule, resolveMailOptions } from './mail.module';
export { MailService } from './mail.service';
export { MailController } from './mail.controller';
export { MAIL_OPTIONS_TOKEN, MAIL_EVENT_EMITTER_TOKEN, MAIL_QUEUE_TOKEN } from './tokens';

export { email, EmailComposer } from './compose/compose';
export { DEFAULT_BRAND, resolveBrands } from './compose/brand';
export type { BrandTheme, BrandColors } from './compose/brand';
export { defineMailable, MailCatalog, globalMailCatalog } from './compose/mailables';
export type { MailableDefinition, MailableClass } from './compose/mailables';

export { DeliveryPolicy } from './policy/delivery-policy';
export { HandlebarsAdapter } from './render/handlebars.adapter';
export { renderHtml } from './render/html.renderer';
export { renderText, htmlToText } from './render/text.renderer';
export { renderMjml } from './render/mjml.renderer';
export { renderIcs } from './render/ics';
export {
  formatAddress,
  formatAddresses,
  extractEmail,
  isValidEmailAddress,
} from './render/address';

export {
  MEMORY_PROVIDER_NAME,
  LOG_PROVIDER_NAME,
  SMTP_PROVIDER_NAME,
  SES_PROVIDER_NAME,
  RESEND_PROVIDER_NAME,
  SENDGRID_PROVIDER_NAME,
  MAILGUN_PROVIDER_NAME,
  MemoryMailProvider,
  LogMailProvider,
  SmtpMailProvider,
  SesMailProvider,
  ResendMailProvider,
  SendGridMailProvider,
  MailgunMailProvider,
} from './providers';
export type { MailProvider, MemoryMailboxEntry } from './providers';

export { MAIL_EVENTS, lifecycleEventName } from './events/mail.events';
export {
  MAIL_SENT,
  MAIL_FAILED,
  MAIL_SUPPRESSED,
  MAIL_INTERCEPTED,
  MAIL_QUEUED,
  MAIL_DEFERRED,
  MAIL_BOUNCED,
  MAIL_COMPLAINED,
  MAIL_DELIVERED,
  MAIL_OPENED,
  MAIL_CLICKED,
} from './events/mail.events';

export { enqueueMail } from './queue/mail.queue';
export type { MailQueueClient, MailQueueJobPayload } from './queue/mail.queue';

export type {
  EmailDocument,
  NormalizedMailMessage,
  MailAddress,
  MailAttachment,
  MailCategory,
  MailCta,
  MailIcsPart,
  MailLayout,
  MailSection,
  MailUnsubscribe,
} from './types/email-document';
export type {
  SendResult,
  ProviderSendResult,
  SendTemplateOptions,
  SendMailableOptions,
  RetryOptions,
  SendInput,
} from './types/send.types';
export type { MailLifecycleEvent, MailLifecycleType } from './types/webhook.types';
export type {
  DeliveryPolicyOptions,
  InterceptOptions,
  QuietHoursOptions,
  RateLimitOptions,
  PolicyDecision,
} from './types/policy.types';
export type {
  MailModuleOptions,
  MailModuleAsyncOptions,
  ResolvedMailModuleOptions,
  SmtpProviderOptions,
  SesProviderOptions,
  ResendProviderOptions,
  SendGridProviderOptions,
  MailgunProviderOptions,
  TemplateEngineOptions,
  MailQueueOptions,
  MailDefaults,
} from './types/module.types';
