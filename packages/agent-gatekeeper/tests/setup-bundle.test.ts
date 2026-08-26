import {
  createAgentGatekeeperBundle,
  formatGatekeeperBootLine,
  getBoundGatekeeper,
  bindGatekeeper,
  resolveAuditSink,
  resumeGatekeeperDecision,
} from '../src/setup';
import { mergeDnaPolicies } from '../src/policy/bridge';
import type { AgentGatekeeperPolicy, ApprovalRequest } from '../src/types';

const allowAll: AgentGatekeeperPolicy = {
  id: 'allow-all',
  version: '1.0.0',
  priority: 1,
  match: { tools: ['*'] },
  rules: { allowWhen: () => true },
};

describe('createAgentGatekeeperBundle', () => {
  it('builds enforce + deny with memory approvals by default', () => {
    const bundle = createAgentGatekeeperBundle({
      policies: [allowAll],
      audit: { testMode: true },
    });
    expect(bundle.enabled).toBe(true);
    expect(bundle.gatekeeper.mode).toBe('enforce');
    expect(bundle.gatekeeper.defaultDecision).toBe('deny');
    expect(bundle.approvalBackend).toBe('memory');
    expect(bundle.auditBackend).toBe('memory');
    expect(typeof bundle.authorizationGate.execute).toBe('function');
  });

  it('disables mode when enabled=false', () => {
    const bundle = createAgentGatekeeperBundle({
      policies: [allowAll],
      enabled: false,
      audit: { testMode: true },
    });
    expect(bundle.enabled).toBe(false);
    expect(bundle.gatekeeper.mode).toBe('disabled');
  });

  it('bindGatekeeper / getBoundGatekeeper round-trip', () => {
    const runtime = {};
    const bundle = createAgentGatekeeperBundle({
      policies: [allowAll],
      audit: { testMode: true },
    });
    bindGatekeeper(runtime, bundle);
    expect(getBoundGatekeeper(runtime)).toBe(bundle);
  });

  it('formatGatekeeperBootLine includes tenant extras', () => {
    const bundle = createAgentGatekeeperBundle({
      policies: [allowAll],
      audit: { testMode: true },
    });
    const line = formatGatekeeperBootLine(bundle, { tenantId: 't1', environment: 'dev' });
    expect(line).toContain('approvals=memory');
    expect(line).toContain('tenant=t1');
    expect(line).toContain('env=dev');
  });

  it('resolveAuditSink uses memory in testMode', () => {
    const { backend } = resolveAuditSink({ testMode: true });
    expect(backend).toBe('memory');
  });
});

describe('mergeDnaPolicies / resumeGatekeeperDecision', () => {
  it('mergeDnaPolicies replaces by id', () => {
    const policies: AgentGatekeeperPolicy[] = [
      {
        id: 'allow-all',
        version: '1.0.0',
        priority: 1,
        match: { tools: ['*'] },
        rules: { allowWhen: () => true },
      },
    ];
    mergeDnaPolicies(policies, {
      policies: [
        {
          id: 'allow-all',
          version: '2.0.0',
          priority: 5,
          match: { tools: ['lookup'] },
          rules: { allowWhen: () => true },
        },
        {
          id: 'new-policy',
          version: '1.0.0',
          priority: 2,
          match: { tools: ['write'] },
          rules: { requireApprovalWhen: () => true },
        },
      ],
    });
    expect(policies).toHaveLength(2);
    expect(policies[0].version).toBe('2.0.0');
    expect(policies[1].id).toBe('new-policy');
  });

  it('resumeGatekeeperDecision resolves provider then resumes', async () => {
    const bundle = createAgentGatekeeperBundle({
      policies: [allowAll],
      audit: { testMode: true },
    });
    const now = new Date();
    const request: ApprovalRequest = {
      approvalId: 'req-1',
      invocationId: 'inv-1',
      runId: 'run-1',
      agentId: 'a',
      tenantId: 't',
      toolName: 'processRefund',
      argumentSummary: {},
      reason: 'test',
      policyIds: [],
      policyVersions: [],
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      riskClassification: 'medium',
      idempotencyKey: 'idem-1',
      invocationFingerprint: 'fp-1',
      status: 'pending',
    };
    await bundle.approvalProvider.create(request);

    const calls: string[] = [];
    const runtime = {
      approveToolExecution: (id: string) => {
        calls.push(`approve:${id}`);
      },
      rejectToolExecution: (id: string) => {
        calls.push(`reject:${id}`);
      },
      approveAndResume: async (id: string, d: { approved: boolean }) => {
        calls.push(`resume:${id}:${d.approved}`);
        return { ok: true };
      },
    };
    bindGatekeeper(runtime, bundle);
    await resumeGatekeeperDecision(runtime, 'req-1', 'approved', 'tester');
    expect(calls).toEqual(['approve:req-1', 'resume:run-1:true']);
  });
});
