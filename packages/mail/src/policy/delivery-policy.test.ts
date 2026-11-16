import { email } from '../compose/compose';
import { DeliveryPolicy } from './delivery-policy';

describe('DeliveryPolicy', () => {
  it('suppresses recipients', async () => {
    const policy = new DeliveryPolicy({
      suppress: async (addr) => addr === 'blocked@example.com',
    });
    const doc = email()
      .subject('Hi')
      .to(['ok@example.com', 'blocked@example.com'])
      .section({ body: 'x' })
      .build();

    const decision = await policy.evaluate(doc);
    expect(decision.action).toBe('allow');
    if (decision.action === 'allow') {
      expect(decision.recipients).toEqual(['ok@example.com']);
    }
  });

  it('intercepts in staging', async () => {
    const policy = new DeliveryPolicy({
      intercept: { enabled: true, to: 'qa@example.com' },
    });
    const doc = email().subject('Hi').to('user@example.com').section({ body: 'x' }).build();
    const decision = await policy.evaluate(doc);
    expect(decision.action).toBe('intercept');
    if (decision.action === 'intercept') {
      expect(decision.recipients).toEqual(['qa@example.com']);
      expect(decision.originalRecipients).toEqual(['user@example.com']);
    }
  });

  it('rejects invalid subjects', async () => {
    const policy = new DeliveryPolicy({ validate: true });
    const doc = email()
      .subject('Bad\nSubject')
      .to('user@example.com')
      .section({ body: 'x' })
      .build();
    await expect(policy.evaluate(doc)).rejects.toThrow(/subject/);
  });
});
