/** Outbound lifecycle events. */
export const MAIL_SENT = 'mail.sent';
export const MAIL_FAILED = 'mail.failed';
export const MAIL_SUPPRESSED = 'mail.suppressed';
export const MAIL_INTERCEPTED = 'mail.intercepted';
export const MAIL_QUEUED = 'mail.queued';
export const MAIL_DEFERRED = 'mail.deferred';

/** Inbound provider lifecycle events. */
export const MAIL_BOUNCED = 'mail.bounced';
export const MAIL_COMPLAINED = 'mail.complained';
export const MAIL_DELIVERED = 'mail.delivered';
export const MAIL_OPENED = 'mail.opened';
export const MAIL_CLICKED = 'mail.clicked';

export const MAIL_EVENTS = {
  SENT: MAIL_SENT,
  FAILED: MAIL_FAILED,
  SUPPRESSED: MAIL_SUPPRESSED,
  INTERCEPTED: MAIL_INTERCEPTED,
  QUEUED: MAIL_QUEUED,
  DEFERRED: MAIL_DEFERRED,
  BOUNCED: MAIL_BOUNCED,
  COMPLAINED: MAIL_COMPLAINED,
  DELIVERED: MAIL_DELIVERED,
  OPENED: MAIL_OPENED,
  CLICKED: MAIL_CLICKED,
} as const;

export type MailEventName = (typeof MAIL_EVENTS)[keyof typeof MAIL_EVENTS];

export function lifecycleEventName(
  type: 'bounce' | 'complaint' | 'delivery' | 'open' | 'click' | 'reject' | 'unknown'
): string {
  switch (type) {
    case 'bounce':
      return MAIL_BOUNCED;
    case 'complaint':
      return MAIL_COMPLAINED;
    case 'delivery':
      return MAIL_DELIVERED;
    case 'open':
      return MAIL_OPENED;
    case 'click':
      return MAIL_CLICKED;
    default:
      return MAIL_FAILED;
  }
}
