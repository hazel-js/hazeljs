import { HealingCoordinator } from '../healing/healing-coordinator';
import {
  createHealingNotifierChain,
  createPagerDutyHealingNotifier,
  createSlackHealingNotifier,
} from '../notifications/healing-notifiers';

describe('Healing notifiers', () => {
  it('sends Slack notification on healing event', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const slack = createSlackHealingNotifier({
      token: 'xoxb-test',
      channel: '#incidents',
      fetchImpl,
    });

    await slack.notify('critical-healing', {
      target: 'PaymentService.charge',
      strategy: 'config-rollback',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('sends PagerDuty event on healing failure', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const pagerDuty = createPagerDutyHealingNotifier({
      routingKey: 'pd-routing-key',
      fetchImpl,
    });

    await pagerDuty.notify('healing-failed', { target: 'OrderService.create' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://events.pagerduty.com/v2/enqueue',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('wires notifiers into coordinator', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const notifier = createHealingNotifierChain([
      createSlackHealingNotifier({
        token: 'xoxb-test',
        channel: '#alerts',
        fetchImpl,
      }),
    ]);

    const coordinator = new HealingCoordinator({
      strategies: ['config-rollback'],
      notifications: notifier,
      notifyOn: ['critical-healing'],
    });

    coordinator.snapshotConfig('baseline', { retries: 1 });
    coordinator.snapshotConfig('broken', { retries: -1 });

    await coordinator.heal(
      'ConfigService.apply',
      Object.assign(new Error('bad config'), { code: 'EINVAL' }),
      { maxAttempts: 1, strategies: ['config-rollback'] }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchImpl).toHaveBeenCalled();
  });
});
