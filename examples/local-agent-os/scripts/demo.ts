#!/usr/bin/env npx tsx
/**
 * In-process demo: apply → HITL refund → kill/restart → approve → complete.
 * Does not require a global hazel install (uses workspace @hazeljs/agent).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AgentRunStatus,
  AgentState,
  HazeldServer,
  ensureHazelHome,
  hazelHome,
  type LLMChatResponse,
  type LLMProvider,
} from '@hazeljs/agent';

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-agent-os-'));
  process.env.HAZEL_HOME = tmp;
  ensureHazelHome(hazelHome(tmp));

  const refundCalls: Array<Record<string, unknown>> = [];
  let llmCalls = 0;
  const llm: LLMProvider = {
    async chat(): Promise<LLMChatResponse> {
      llmCalls += 1;
      if (llmCalls === 1) {
        return {
          content: '',
          finishReason: 'tool_calls',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: {
                name: 'refund',
                arguments: JSON.stringify({ amount: 42, orderId: 'ord_42' }),
              },
            },
          ],
        };
      }
      return { content: 'Refund completed.', finishReason: 'stop' };
    },
  };

  const shared = {
    home: tmp,
    projectRoot: path.join(__dirname, '..'),
    socketPath: path.join(tmp, 'demo.sock'),
    gatekeeperEnabled: false,
    jobTickMs: 60_000,
    reconcileMs: 60_000,
    llmProvider: llm,
    skillHandlers: {
      lookup_order: async (input: Record<string, unknown>) => ({
        orderId: input.orderId,
        status: 'paid',
      }),
      refund: async (input: Record<string, unknown>) => {
        refundCalls.push(input);
        return { ok: true, ...input };
      },
    },
  };

  console.log('1) Start hazeld, apply support_desk DNA');
  let server = new HazeldServer(shared);
  await server.start();
  await server.node.apply({
    name: 'support_desk',
    mission: 'Help with orders and refunds',
    skills: [
      { name: 'lookup_order', description: 'Look up an order' },
      { name: 'refund', description: 'Issue a refund', requiresApproval: true },
    ],
  });

  console.log('2) Start run that requests refund (HITL)');
  const waitingExec = await server.node.agentOs.runtime.execute(
    'support_desk',
    'Please refund order ord_42',
    { maxSteps: 5 }
  );
  console.log('   exec state:', waitingExec.state, '(expect WAITING_FOR_APPROVAL)');
  const run = await server.node.store.runs.get(waitingExec.executionId);
  console.log('   run status:', run?.status, '(expect SUSPENDED / WAITING_FOR_HUMAN)');
  if (refundCalls.length) throw new Error('refund executed before approval');

  console.log('3) Kill hazeld (simulate crash)');
  await server.stop();

  console.log('4) Restart hazeld — WaitingApproval preserved');
  server = new HazeldServer(shared);
  await server.start();
  const recovered = await server.node.recover();
  console.log('   recover:', recovered);
  const runs = await server.node.listRuns('support_desk');
  const waiting = runs.find(
    (r) => r.status === AgentRunStatus.SUSPENDED || r.status === AgentRunStatus.WAITING_FOR_HUMAN
  );
  if (!waiting) throw new Error('expected waiting run after restart');

  console.log('5) Approve → run completes');
  const approvals = await server.node.listApprovals();
  const id = approvals[0]?.id ?? waiting.id;
  const done = await server.node.approve(id, 'demo');
  console.log('   result:', done.state);
  if (done.state !== AgentState.COMPLETED) throw new Error('expected COMPLETED');
  if (refundCalls.length !== 1) throw new Error('expected one refund after approve');

  const view = await server.node.inspect('support_desk');
  console.log('6) inspect:', view.displayStatus, '(agent still registered)');

  await server.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\n✓ Demo OK — local-first HITL survive restart');
  // Timers from hazeld (job/reconcile) can keep the event loop alive.
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
