/**
 * Policy engine tests - deny on missing tenant
 */

import { PolicyEngine, requireTenant, createRiskOS, PolicyDeniedError } from '../src';

describe('PolicyEngine', () => {
  it('denies when tenantId is missing', async () => {
    const policyEngine = new PolicyEngine();
    policyEngine.addPolicy(requireTenant());

    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      policyEngine,
      enforcePolicies: true,
    });

    await expect(
      riskos.run('test', { purpose: 'test' }, () => 'ok'),
    ).rejects.toThrow(PolicyDeniedError);
  });

  it('allows when tenantId is present', async () => {
    const policyEngine = new PolicyEngine();
    policyEngine.addPolicy(requireTenant());

    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      policyEngine,
      enforcePolicies: true,
    });

    const result = await riskos.run(
      'test',
      { tenantId: 't1', purpose: 'test' },
      () => 'ok',
    );
    expect(result).toBe('ok');
  });
});
