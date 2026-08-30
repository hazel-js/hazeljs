import { HealingCoordinator } from '../healing/healing-coordinator';
import { createStrategy } from '../healing/strategies';

describe('HealingCoordinator', () => {
  it('executes config rollback strategy', async () => {
    const coordinator = new HealingCoordinator({
      strategies: ['config-rollback'],
      notifyOn: ['auto-rollback'],
      onNotify: jest.fn(),
    });

    coordinator.snapshotConfig('baseline', { retries: 3 });

    const result = await coordinator.heal(
      'PaymentService.charge',
      Object.assign(new Error('Invalid config'), { code: 'EINVAL' }),
      { maxAttempts: 1 }
    );

    expect(result.recovered).toBe(true);
    expect(result.actions.some((action) => action.strategy === 'config-rollback')).toBe(true);
  });

  it('retries method after healing', async () => {
    const coordinator = new HealingCoordinator({ strategies: ['auto-restart'] });
    let calls = 0;

    const value = await coordinator.executeWithHealing(
      'FlakyService.run',
      async () => {
        calls += 1;
        if (calls < 2) {
          throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
        }
        return 'ok';
      },
      { maxAttempts: 3, onError: 'diagnose-and-fix' }
    );

    expect(value).toBe('ok');
    expect(calls).toBe(2);
  });

  it('activates safe mode fallback', async () => {
    const coordinator = new HealingCoordinator({ strategies: ['safe-mode'] });
    const instance = {
      processPaymentSafe: jest.fn().mockResolvedValue('safe-result'),
    };

    const result = await coordinator.heal(
      'PaymentController.processPayment',
      new Error('fatal'),
      { onError: 'safe-mode-only', fallback: 'processPaymentSafe', maxAttempts: 1 },
      instance,
      [{ amount: 10 }]
    );

    expect(result.recovered).toBe(true);
    expect(instance.processPaymentSafe).toHaveBeenCalledWith({ amount: 10 });
  });
});

describe('Healing strategies', () => {
  it('runs memory cleanup when gc is available', async () => {
    const originalGc = global.gc;
    global.gc = jest.fn();

    const strategy = createStrategy('memory-cleanup');
    const result = await strategy.execute({
      target: 'CacheService',
      error: new Error('oom'),
      attempt: 1,
      maxAttempts: 1,
      instance: { clearCache: jest.fn().mockResolvedValue(undefined) },
    });

    expect(result.success).toBe(true);
    expect(global.gc).toHaveBeenCalled();

    global.gc = originalGc;
  });
});
