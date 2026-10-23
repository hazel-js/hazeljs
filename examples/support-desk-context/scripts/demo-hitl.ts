#!/usr/bin/env npx tsx
/**
 * In-process HITL proof: apply DNA → refund pauses for approval.
 * Complements npm run demo (ContextService planner walkthrough).
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
import { assembleContext, rememberPreference } from '../context';

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'support-desk-context-'));
  process.env.HAZEL_HOME = tmp;
  ensureHazelHome(hazelHome(tmp));

  console.log('0) Context layers (offline)');
  await rememberPreference('desk-user', 'contact_channel', 'email');
  const assembled = await assembleContext('Who owns ORD-2042 and what is the refund policy?', {
    userId: 'desk-user',
  });
  console.log('   sourcesUsed:', assembled.sourcesUsed.join(', '));
  console.log('   tokenEstimate:', assembled.tokenEstimate);

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
                name: 'issue_refund',
                arguments: JSON.stringify({ orderId: 'ORD-2042', amount: 148 }),
              },
            },
          ],
        };
      }
      return { content: 'Refund submitted for approval.', finishReason: 'stop' };
    },
  };

  const projectRoot = path.join(__dirname, '..');
  const server = new HazeldServer({
    home: tmp,
    projectRoot,
    socketPath: path.join(tmp, 'demo.sock'),
    gatekeeperEnabled: false,
    jobTickMs: 60_000,
    reconcileMs: 60_000,
    llmProvider: llm,
    skillHandlers: {
      issue_refund: async (input: Record<string, unknown>) => ({
        ok: true,
        ...input,
        currency: 'USD',
      }),
      lookup_order: async (input: Record<string, unknown>) => ({
        found: true,
        orderId: input.orderId,
        total: 148,
      }),
    },
  });

  console.log('\\n1) Start hazeld, apply support_desk_context DNA');
  await server.start();
  await server.node.apply({
    name: 'support_desk_context',
    mission: 'Help with orders and refunds; refunds need approval',
    skills: [
      { name: 'lookup_order', description: 'Look up an order' },
      { name: 'issue_refund', description: 'Issue a refund', requiresApproval: true },
    ],
  });

  console.log('2) Execute refund → expect WaitingApproval');
  const waiting = await server.node.agentOs.runtime.execute(
    'support_desk_context',
    'Customer asks to refund order ORD-2042',
    { maxSteps: 8 }
  );
  const run = await server.node.store.runs.get(waiting.executionId);
  const suspended =
    run?.status === AgentRunStatus.SUSPENDED ||
    run?.status === AgentRunStatus.WAITING_FOR_HUMAN ||
    waiting.state === AgentState.WAITING_FOR_APPROVAL;

  const approvals = await server.node.listApprovals();
  console.log('   state:', waiting.state);
  console.log('   suspended:', suspended);
  console.log('   approvals:', approvals.length);
  if (!suspended || approvals.length < 1) {
    throw new Error('expected HITL pause with at least one approval task');
  }

  const taskId = approvals[0]!.id;
  console.log('3) Approve', taskId);
  await server.node.approve(taskId, 'demo');
  const after = await server.node.store.runs.get(waiting.executionId);
  console.log('   run status after approve:', after?.status ?? '(unknown)');

  await server.stop();
  console.log('\\n✓ Context layers + HITL refund path OK\\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
