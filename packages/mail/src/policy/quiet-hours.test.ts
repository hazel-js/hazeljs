import { email } from '../compose/compose';
import { DeliveryPolicy } from './delivery-policy';

describe('DeliveryPolicy quiet hours & rate limit', () => {
  it('defers marketing mail during quiet hours', async () => {
    const hour = new Date().getHours();
    const policy = new DeliveryPolicy({
      quietHours: {
        category: 'marketing',
        start: hour,
        end: (hour + 2) % 24,
      },
    });
    const doc = email()
      .category('marketing')
      .subject('Promo')
      .to('a@b.com')
      .section({ body: 'sale' })
      .build();
    const decision = await policy.evaluate(doc);
    expect(decision.action).toBe('defer');
  });

  it('defers when rate limit exceeded', async () => {
    const policy = new DeliveryPolicy({
      rateLimit: { maxMessages: 1, periodMs: 60_000 },
    });
    const doc = email().subject('One').to('a@b.com').section({ body: 'x' }).build();
    expect((await policy.evaluate(doc)).action).toBe('allow');
    const second = await policy.evaluate(doc);
    expect(second.action).toBe('defer');
  });
});
