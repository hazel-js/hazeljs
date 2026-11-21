import {
  AgentGatekeeper,
  InMemoryApprovalProvider,
  createGovernedToolExecutor,
  MemoryDistributedLock,
  MemoryToolAttemptLedger,
} from '@hazeljs/agent-gatekeeper';
import { z } from 'zod';
import { AgentState, ensureHazelHome, hazelHome } from '@hazeljs/agent';
import { AGENT_NAME, createRefundHazeld, refundDna } from '../app/create-refund-node';
import { createFixture } from './helpers';
import { recordScenario } from './report';
import * as fs from 'fs';
import * as path from 'path';

describe('approval integrity + revocation', () => {
  it('revokes refund at execution boundary after approval requested', async () => {
    const fx = await createFixture('hz-rev');
    ensureHazelHome(hazelHome(fx.home));
    const policyPath = path.join(fx.root, 'policy.json');
    fs.writeFileSync(policyPath, JSON.stringify({ allowRefund: true }));
    const steps: string[] = [];

    const server = createRefundHazeld({
      home: fx.home,
      durableDir: fx.durableDir,
      socketPath: fx.socketPath,
      workerId: `rev-${process.pid}`,
      fakeBaseUrl: fx.fake.baseUrl,
      authHeader: fx.authHeader,
      orderId: fx.orderId,
      amountMinor: fx.amountMinor,
      operationKey: fx.operationKey,
      policyPath,
    });
    try {
      await server.start();
      await server.node.apply(refundDna());
      const waiting = await server.node.agentOs.runtime.execute(AGENT_NAME, 'refund', {
        maxSteps: 8,
      });
      steps.push(`execute → waiting; then flipped policy allowRefund=false`);
      fs.writeFileSync(policyPath, JSON.stringify({ allowRefund: false }));
      const done = await server.node.approve(waiting.executionId, 'ops@test');
      expect(done.state).not.toBe(AgentState.COMPLETED);
      expect(fx.fake.stats().refundCount).toBe(0);
      steps.push(`approve after revoke → state=${done.state}; refundCount=0`);

      recordScenario({
        id: 'D-revocation-at-execution',
        title: 'revokes refund at execution boundary after approval requested',
        status: 'pass',
        steps,
        observations: {
          finalState: done.state,
          refundCount: fx.fake.stats().refundCount,
        },
        claim: 'Policy flip after HITL request prevents refund effect on approve.',
      });
    } catch (err) {
      recordScenario({
        id: 'D-revocation-at-execution',
        title: 'revokes refund at execution boundary after approval requested',
        status: 'fail',
        steps,
        observations: { refundCount: fx.fake.stats().refundCount },
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      await server.stop();
      await fx.cleanup();
    }
  }, 60_000);

  it('gatekeeper governed path rejects tampered amount with old approval', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const ledger = new MemoryToolAttemptLedger(lock);
    let effects = 0;
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'refund-hitl',
          version: '1',
          priority: 10,
          match: { tools: ['refund.create'] },
          rules: { requireApprovalWhen: () => true },
        },
      ],
      approvalProvider: approvals,
      mode: 'enforce',
      defaultDecision: 'deny',
    });
    const executor = createGovernedToolExecutor({
      gatekeeper,
      approvals,
      lock,
      ledger,
      tools: new Map([
        [
          'refund.create',
          {
            name: 'refund.create',
            inputSchema: z.object({
              orderId: z.string(),
              amountMinor: z.number(),
              currency: z.string(),
            }),
            classification: 'destructive' as const,
            execute: async () => ({ ok: true }),
          },
        ],
      ]),
      dispatch: async () => {
        effects += 1;
        return { ok: true };
      },
    });
    const caller = {
      tenantId: 't1',
      actorId: 'a1',
      runId: 'r1',
      capabilities: ['refund'],
      policyVersion: 'p1',
      environment: 'test' as const,
    };
    const first = await executor.execute(caller, {
      toolName: 'refund.create',
      input: { orderId: 'o1', amountMinor: 100, currency: 'USD' },
      idempotencyKey: 'idem-1',
      classification: 'destructive',
    });
    expect(first.outcome).toBe('require_approval');
    await approvals.resolve(first.approvalId!, 'approved', 'human-1');
    const tampered = await executor.execute(caller, {
      toolName: 'refund.create',
      input: { orderId: 'o1', amountMinor: 999, currency: 'USD' },
      idempotencyKey: 'idem-2',
      classification: 'destructive',
      approvalToken: first.approvalId,
    });
    expect(tampered.outcome).not.toBe('succeeded');
    expect(effects).toBe(0);

    recordScenario({
      id: 'E-gatekeeper-tamper',
      title: 'gatekeeper governed path rejects tampered amount with old approval',
      status: 'pass',
      steps: [
        'Governed executor required approval for refund.create',
        'Human approved amountMinor=100',
        'Replay with amountMinor=999 + old approval token rejected; effects=0',
      ],
      observations: {
        firstOutcome: first.outcome,
        tamperedOutcome: tampered.outcome,
        effects,
      },
      claim: 'Approval is bound to tool input; tampered amount does not execute.',
    });
  });
});

describe('mcp tasks', () => {
  it('reports unsupported — no MCP Tasks API in @hazeljs/mcp', () => {
    const mcpIndex = path.resolve(__dirname, '../../../packages/mcp/src/index.ts');
    const text = fs.readFileSync(mcpIndex, 'utf8');
    const unsupported = !/CreateTask|listTasks|tasks\//i.test(text);
    expect(unsupported).toBe(true);

    recordScenario({
      id: 'G-mcp-tasks',
      title: 'reports unsupported — no MCP Tasks API in @hazeljs/mcp',
      status: 'unsupported',
      steps: ['Read packages/mcp/src/index.ts', 'No CreateTask / listTasks / tasks/ surface found'],
      observations: {
        package: '@hazeljs/mcp',
        source: 'packages/mcp/src/index.ts',
        hasTasksApi: false,
      },
      claim: 'MCP Tasks conformance is unsupported — API absent in package.',
    });
  });
});
