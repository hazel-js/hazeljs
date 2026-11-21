/**
 * HazeldServer in-process — tools from agent.ts (@Agent / @Tool).
 */
import { AgentRunStatus, AgentState, ensureHazelHome, hazelHome } from '@hazeljs/agent';
import { AGENT_NAME, createRefundHazeld, refundDna } from '../app/create-refund-node';
import { createFixture } from './helpers';
import { recordScenario } from './report';

describe('baseline refund (HazeldServer)', () => {
  it('approved refund commits one effect; denied commits none', async () => {
    const fx = await createFixture();
    ensureHazelHome(hazelHome(fx.home));
    const steps: string[] = [];

    const server = createRefundHazeld({
      home: fx.home,
      durableDir: fx.durableDir,
      socketPath: fx.socketPath,
      workerId: `w-${process.pid}`,
      fakeBaseUrl: fx.fake.baseUrl,
      authHeader: fx.authHeader,
      orderId: fx.orderId,
      amountMinor: fx.amountMinor,
      operationKey: fx.operationKey,
    });

    try {
      await server.start();
      await server.node.apply(refundDna());
      steps.push('Started HazeldServer and applied DNA (agent.ts @Tool handlers)');

      const waiting = await server.node.agentOs.runtime.execute(
        AGENT_NAME,
        'Please refund the order',
        { maxSteps: 8 }
      );
      expect(waiting.state).toBe(AgentState.WAITING_FOR_APPROVAL);
      expect(fx.fake.stats().refundCount).toBe(0);
      steps.push(
        `execute → ${waiting.state}; refundCount=${fx.fake.stats().refundCount} (no effect before approval)`
      );

      const done = await server.node.approve(waiting.executionId, 'ops@test');
      expect(done.state).toBe(AgentState.COMPLETED);
      expect(fx.fake.stats().refundCount).toBe(1);
      expect(fx.fake.stats().refunds[0].tenantId).toBe(fx.tenantId);
      expect(fx.fake.stats().refunds[0].amountMinor).toBe(fx.amountMinor);
      steps.push(
        `approve → ${done.state}; refundCount=1 tenant=${fx.tenantId} amountMinor=${fx.amountMinor}`
      );

      const waiting2 = await server.node.agentOs.runtime.execute(
        AGENT_NAME,
        'Please refund again',
        { maxSteps: 8 }
      );
      const denied = await server.node.deny(waiting2.executionId, 'ops@test');
      expect(denied.state).toBe(AgentState.FAILED);
      expect(fx.fake.stats().refundCount).toBe(1);
      steps.push(`deny second run → ${denied.state}; refundCount still 1`);

      const run = await server.node.agentOs.store.runRepository.get(waiting.executionId);
      expect(run?.status).toBe(AgentRunStatus.COMPLETED);

      recordScenario({
        id: 'A-baseline-approve-deny',
        title: 'approved refund commits one effect; denied commits none',
        status: 'pass',
        steps,
        observations: {
          mode: 'in-process HazeldServer',
          agent: AGENT_NAME,
          approvedRunId: waiting.executionId,
          approvedState: done.state,
          deniedState: denied.state,
          refundCount: fx.fake.stats().refundCount,
          refundTenantId: fx.fake.stats().refunds[0]?.tenantId,
          refundAmountMinor: fx.fake.stats().refunds[0]?.amountMinor,
          durableRunStatus: run?.status,
        },
        claim: 'HITL approve commits exactly one fake refund; deny commits none.',
      });
    } catch (err) {
      recordScenario({
        id: 'A-baseline-approve-deny',
        title: 'approved refund commits one effect; denied commits none',
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
});
