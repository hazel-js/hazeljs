import {
  lifecycleEventName,
  MAIL_BOUNCED,
  MAIL_CLICKED,
  MAIL_COMPLAINED,
  MAIL_DELIVERED,
  MAIL_FAILED,
  MAIL_OPENED,
} from './mail.events';

describe('lifecycleEventName', () => {
  it('maps lifecycle types', () => {
    expect(lifecycleEventName('bounce')).toBe(MAIL_BOUNCED);
    expect(lifecycleEventName('complaint')).toBe(MAIL_COMPLAINED);
    expect(lifecycleEventName('delivery')).toBe(MAIL_DELIVERED);
    expect(lifecycleEventName('open')).toBe(MAIL_OPENED);
    expect(lifecycleEventName('click')).toBe(MAIL_CLICKED);
    expect(lifecycleEventName('reject')).toBe(MAIL_FAILED);
    expect(lifecycleEventName('unknown')).toBe(MAIL_FAILED);
  });
});

