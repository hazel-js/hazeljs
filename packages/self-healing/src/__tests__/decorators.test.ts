import 'reflect-metadata';
import { SelfHeal, SelfHealing } from '../decorators';
import { HealingRegistry } from '../healing/healing-coordinator';

describe('Self-healing decorators', () => {
  afterEach(() => {
    HealingRegistry.reset();
  });

  it('wraps methods with @SelfHeal', async () => {
    @SelfHealing({ strategies: ['auto-restart'] })
    class PaymentService {
      attempts = 0;

      @SelfHeal({ maxAttempts: 3, onError: 'diagnose-and-fix' })
      async charge(): Promise<string> {
        this.attempts += 1;
        if (this.attempts < 2) {
          throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
        }
        return 'charged';
      }
    }

    const service = new PaymentService();
    await expect(service.charge()).resolves.toBe('charged');
    expect(service.attempts).toBe(2);
  });
});
