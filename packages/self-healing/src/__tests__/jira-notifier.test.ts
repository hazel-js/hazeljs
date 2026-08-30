import { createJiraHealingNotifier } from '../integrations/ops-agent';

describe('Jira healing notifier', () => {
  it('creates Jira ticket on healing-failed', async () => {
    const jira = {
      createTicket: jest.fn().mockResolvedValue({ key: 'OPS-101', id: '1' }),
    };

    const notifier = createJiraHealingNotifier({
      jira,
      project: 'OPS',
    });

    await notifier.notify('healing-failed', {
      target: 'PaymentService.charge',
      diagnosis: { category: 'dependency', message: 'Gateway down' },
    });

    expect(jira.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'OPS',
        summary: expect.stringContaining('PaymentService.charge'),
      })
    );
  });

  it('ignores events outside configured list', async () => {
    const jira = {
      createTicket: jest.fn(),
    };

    const notifier = createJiraHealingNotifier({
      jira,
      project: 'OPS',
      events: ['healing-failed'],
    });

    await notifier.notify('critical-healing', { target: 'x' });
    expect(jira.createTicket).not.toHaveBeenCalled();
  });
});
