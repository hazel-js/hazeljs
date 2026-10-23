/**
 * Kill hazeld mid-HITL → restart → WaitingApproval preserved → approve resumes.
 * Non-HITL SUSPENDED without checkpoint → Failed (no silent retry).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  HazeldServer,
  AgentRunStatus,
  AgentState,
  ensureHazelHome,
  hazelHome,
  type LLMProvider,
  type LLMChatRequest,
  type LLMChatResponse,
} from '../../src';

const refundCalls: Array<Record<string, unknown>> = [];

function mockLlmForRefundThenDone(): LLMProvider {
  let calls = 0;
  return {
    async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
      calls += 1;
      if (calls === 1) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'refund',
                arguments: JSON.stringify({ amount: 42, orderId: 'ord_1' }),
              },
            },
          ],
        };
      }
      return { content: 'Refund completed.', finishReason: 'stop' };
    },
  };
}

describe('hazeld recover HITL E2E', () => {
  let tmp: string;

  beforeEach(() => {
    refundCalls.length = 0;
    const root = path.join(__dirname, '..', '..', '.tmp-test');
    fs.mkdirSync(root, { recursive: true });
    tmp = fs.mkdtempSync(path.join(root, 'recover-'));
    process.env.HAZEL_HOME = tmp;
    ensureHazelHome(hazelHome(tmp));
  });

  afterEach(async () => {
    delete process.env.HAZEL_HOME;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('preserves HITL across hazeld restart then approve completes', async () => {
    const socketPath = path.join(tmp, 'a.sock');
    const shared = {
      home: tmp,
      projectRoot: tmp,
      socketPath,
      gatekeeperEnabled: false,
      jobTickMs: 60_000,
      reconcileMs: 60_000,
      llmProvider: mockLlmForRefundThenDone(),
      skillHandlers: {
        refund: async (input: Record<string, unknown>) => {
          refundCalls.push(input);
          return { ok: true, amount: input.amount };
        },
      },
    };

    const serverA = new HazeldServer(shared);
    await serverA.start();
    try {
      await serverA.node.apply({
        name: 'support',
        mission: 'Refund when asked',
        skills: [{ name: 'refund', description: 'Issue a refund', requiresApproval: true }],
      });

      // Use runtime.execute (not AgentOS.start loop) so tool HITL is deterministic.
      const waitingExec = await serverA.node.agentOs.runtime.execute(
        'support',
        'Please refund order ord_1',
        { maxSteps: 5 }
      );
      expect(waitingExec.state).toBe(AgentState.WAITING_FOR_APPROVAL);
      expect(refundCalls).toHaveLength(0);

      const run = await serverA.node.store.runs.get(waitingExec.executionId);
      expect(run).toBeDefined();
      expect(
        run!.status === AgentRunStatus.SUSPENDED ||
          run!.status === AgentRunStatus.WAITING_FOR_HUMAN
      ).toBe(true);
      expect(run!.checkpointId).toBeDefined();
    } finally {
      await serverA.stop();
    }

    // Simulate process restart with same durable dirs.
    const serverB = new HazeldServer(shared);
    await serverB.start();
    try {
      const recovered = await serverB.node.recover();
      expect(recovered.preservedHitl).toBeGreaterThanOrEqual(1);

      const runs = await serverB.node.listRuns('support');
      const waiting = runs.find(
        (r) =>
          r.status === AgentRunStatus.SUSPENDED ||
          r.status === AgentRunStatus.WAITING_FOR_HUMAN
      );
      expect(waiting).toBeDefined();

      const approvals = await serverB.node.listApprovals();
      const taskId = approvals[0]?.id ?? waiting!.id;
      const done = await serverB.node.approve(taskId, 'ops@test');
      expect(done.state).toBe(AgentState.COMPLETED);
      expect(refundCalls).toHaveLength(1);

      const final = await serverB.node.store.runs.get(waiting!.id);
      expect(final?.status).toBe(AgentRunStatus.COMPLETED);
    } finally {
      await serverB.stop();
    }
  }, 30_000);

  it('marks non-HITL SUSPENDED Failed without silent retry', async () => {
    const socketPath = path.join(tmp, 'b.sock');
    const server = new HazeldServer({
      home: tmp,
      projectRoot: tmp,
      socketPath,
      gatekeeperEnabled: false,
      jobTickMs: 60_000,
      reconcileMs: 60_000,
    });
    await server.start();
    try {
      await server.node.apply({
        name: 'reader',
        mission: 'Read only',
        skills: [{ name: 'ping', description: 'ping' }],
      });

      const run = await server.node.store.runs.create({
        id: 'zombie_run_1',
        agentName: 'reader',
        input: 'mid-flight',
      });
      // Force into SUSPENDED without a HITL checkpoint (unsafe mid-flight).
      await server.node.store.runs.updateStatus(run.id, AgentRunStatus.RUNNING);
      await server.node.store.runs.updateStatus(run.id, AgentRunStatus.SUSPENDED);

      const result = await server.node.recover();
      expect(result.continued).toBeGreaterThanOrEqual(1);

      const after = await server.node.store.runs.get(run.id);
      expect(after?.status).toBe(AgentRunStatus.FAILED);
      expect(after?.error?.code).toBe('NODE_RECOVER_NO_CHECKPOINT');

      const events = server.node.store.events.list({ limit: 50 });
      expect(
        events.some(
          (e) =>
            e.reason === 'NODE_RECOVER_NO_CHECKPOINT' ||
            e.attributes?.code === 'NODE_RECOVER_NO_CHECKPOINT'
        )
      ).toBe(true);
    } finally {
      await server.stop();
    }
  }, 20_000);

  it('recover control op smoke', async () => {
    const socketPath = path.join(tmp, 'c.sock');
    const server = new HazeldServer({
      home: tmp,
      projectRoot: tmp,
      socketPath,
      gatekeeperEnabled: false,
      jobTickMs: 60_000,
      reconcileMs: 60_000,
    });
    await server.start();
    try {
      const { controlRequest } = await import('../../src');
      const res = await controlRequest({ op: 'recover' }, socketPath);
      expect(res.ok).toBe(true);
      expect(res.data).toMatchObject({
        reclaimed: expect.any(Number),
        rearmed: expect.any(Number),
        continued: expect.any(Number),
      });
    } finally {
      await server.stop();
    }
  });
});
