import { lifecycleEventName, MAIL_BOUNCED, MAIL_DELIVERED, MAIL_FAILED } from './mail.events';

describe('lifecycleEventName', () => {
  it('maps lifecycle types', () => {
    expect(lifecycleEventName('bounce')).toBe(MAIL_BOUNCED);
    expect(lifecycleEventName('delivery')).toBe(MAIL_DELIVERED);
    expect(lifecycleEventName('unknown')).toBe(MAIL_FAILED);
  });
});
