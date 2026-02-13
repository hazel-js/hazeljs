/**
 * Compliance policy tests
 */

import { PolicyEngine } from '../src';
import { requireAuthz } from '../src/compliance/policies/requireAuthz';
import { denyCrossTenant } from '../src/compliance/policies/denyCrossTenant';
import { piiRedaction } from '../src/compliance/policies/piiRedaction';
import { modelAllowlist } from '../src/compliance/policies/modelAllowlist';
import { approvalGate } from '../src/compliance/policies/approvalGate';
import { requireSourcesForAI } from '../src/compliance/policies/requireSourcesForAI';

describe('requireAuthz', () => {
  const pe = new PolicyEngine();
  pe.addPolicy(requireAuthz());

  it('allows when role in allowlist', async () => {
    const r = await pe.evaluateBefore({ actionName: 'x', actor: { role: 'admin' } });
    expect(r[0].result).toBe('ALLOW');
  });

  it('denies when role missing', async () => {
    const r = await pe.evaluateBefore({ actionName: 'x' });
    expect(r[0].result).toBe('DENY');
  });

  it('denies when role not in allowlist', async () => {
    const r = await pe.evaluateBefore({ actionName: 'x', actor: { role: 'guest' } });
    expect(r[0].result).toBe('DENY');
  });

  it('custom allowedRoles', async () => {
    const pe2 = new PolicyEngine();
    pe2.addPolicy(requireAuthz({ allowedRoles: ['custom'] }));
    const r = await pe2.evaluateBefore({ actionName: 'x', actor: { role: 'custom' } });
    expect(r[0].result).toBe('ALLOW');
  });
});

describe('denyCrossTenant', () => {
  const pe = new PolicyEngine();
  pe.addPolicy(denyCrossTenant());

  it('allows when tenant matches', async () => {
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      tenantId: 't1',
      event: { type: 'dataAccess', payload: { tenantId: 't1' } } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });

  it('denies when tenant mismatches', async () => {
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      tenantId: 't1',
      event: { type: 'dataAccess', payload: { tenantId: 't2' } } as never,
    });
    expect(r[0].result).toBe('DENY');
  });
});

describe('piiRedaction', () => {
  const pe = new PolicyEngine();
  pe.addPolicy(piiRedaction());

  it('transforms event with payload', async () => {
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'dataAccess', payload: { email: 'a@b.com', x: 1 } } as never,
    });
    expect(r[0].result).toBe('TRANSFORM');
    expect(r[0].transformed).toBeDefined();
    const p = (r[0].transformed as { payload?: Record<string, unknown> })?.payload;
    expect(p?.email).toBe('[REDACTED]');
    expect(p?.x).toBe(1);
  });

  it('allows when no payload', async () => {
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'metric', name: 'x' } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });
});

describe('modelAllowlist', () => {
  it('allows aiCall with allowed model', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(modelAllowlist({ allowedModels: ['gpt-4'] }));
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'aiCall', model: 'gpt-4' } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });

  it('denies aiCall with disallowed model when strict', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(modelAllowlist({ allowedModels: ['gpt-4'], strict: true }));
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'aiCall', model: 'unknown' } as never,
    });
    expect(r[0].result).toBe('DENY');
  });

  it('allows non-aiCall events', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(modelAllowlist({ allowedModels: ['gpt-4'] }));
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'metric', name: 'x' } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });
});

describe('approvalGate', () => {
  it('transforms decision when score above threshold', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(approvalGate({ reviewThreshold: 50 }));
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'decision', score: 60, status: 'APPROVED' } as never,
    });
    expect(r[0].result).toBe('TRANSFORM');
  });

  it('allows when score below threshold', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(approvalGate({ reviewThreshold: 90 }));
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'decision', score: 50 } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });
});

describe('requireSourcesForAI', () => {
  it('denies aiCall without sources', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(requireSourcesForAI());
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'aiCall' } as never,
    });
    expect(r[0].result).toBe('DENY');
  });

  it('allows aiCall with sources', async () => {
    const pe = new PolicyEngine();
    pe.addPolicy(requireSourcesForAI());
    const r = await pe.evaluateOnEvent({
      actionName: 'x',
      event: { type: 'aiCall', sources: ['doc1'] } as never,
    });
    expect(r[0].result).toBe('ALLOW');
  });
});
