import { z } from 'zod';
import { AIModule } from '../ai.module';
import { AIEnhancedService } from '../ai-enhanced.service';
import { FakeModel } from '../testing/fake-model';
import { AgentTool } from '../tools/agent-tool.decorator';
import { InMemoryApprovalPort } from '../approval/approval-port';
import { GatekeeperApprovalPort } from '../approval/gatekeeper-approval-port';
import { InMemoryCallCheckpointStore } from '../approval/call-checkpoint-store';

function resetModule(): void {
  AIModule.register({});
}

describe('durable HITL tool loop', () => {
  afterEach(() => {
    resetModule();
  });

  it('suspends on Gatekeeper require_approval and resumes with token', async () => {
    AIModule.register({
      models: {
        default: { provider: 'openai', model: 'gpt-4o' },
      },
      defaults: { maxSteps: 5 },
    });

    const refundCalls: unknown[] = [];
    class Tools {
      @AgentTool({
        name: 'refund',
        description: 'refund an order',
        inputSchema: z.object({ orderId: z.string() }),
      })
      async refund(input: { orderId: string }) {
        refundCalls.push(input);
        return { refunded: input.orderId };
      }
    }

    let approved = false;
    const port = new GatekeeperApprovalPort({
      async evaluate(req) {
        if (req.approvalToken === 'tok_ok') {
          return { status: 'allowed' };
        }
        if (approved) {
          return { status: 'allowed' };
        }
        return { status: 'require_approval', approvalId: 'appr_1' };
      },
    });

    const fake = new FakeModel([
      { toolCalls: [{ name: 'refund', input: { orderId: 'ord_1' }, id: 'call_0' }] },
      'Refund completed.',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);
    ai.registerTools(new Tools());
    ai.setApprovalPort(port);
    const store = new InMemoryCallCheckpointStore();
    ai.setCheckpointStore(store);

    const suspended = await ai.complete(
      { messages: [{ role: 'user', content: 'refund please' }] },
      { modelName: 'default', tools: ['refund'], approve: ['refund'] }
    );

    expect(suspended.finishReason).toBe('approval-required');
    expect(suspended.approvalId).toBe('appr_1');
    expect(suspended.checkpointId).toBeTruthy();
    expect(refundCalls).toHaveLength(0);
    expect(await store.get(suspended.checkpointId!)).toBeTruthy();

    approved = true;
    const resumed = await ai.resumeAfterApproval({
      checkpointId: suspended.checkpointId!,
      approvalId: 'appr_1',
      approvalToken: 'tok_ok',
    });

    expect(refundCalls).toEqual([{ orderId: 'ord_1' }]);
    expect(resumed.finishReason).toBe('stop');
    expect(resumed.content).toContain('Refund completed');
    expect(await store.get(suspended.checkpointId!)).toBeUndefined();
  });

  it('GatekeeperApprovalPort maps denied without reason to rejected', async () => {
    const port = new GatekeeperApprovalPort({
      async evaluate() {
        return { status: 'denied' };
      },
    });
    await expect(port.approve({ toolName: 't', input: {}, idempotencyKey: 'k' })).resolves.toEqual({
      rejected: 'denied',
    });
  });

  it('InMemoryApprovalPort pending() and setDecision approve path', async () => {
    const port = new InMemoryApprovalPort();
    port.setDecision('k1', 'approved');
    await expect(port.approve({ toolName: 't', input: {}, idempotencyKey: 'k1' })).resolves.toBe(
      'approved'
    );
    expect(port.pending()).toHaveLength(1);
  });

  it('InMemoryApprovalPort rejection path still works without suspend', async () => {
    AIModule.register({
      models: { default: { provider: 'openai', model: 'gpt-4o' } },
      defaults: { maxSteps: 5 },
    });

    class Tools {
      @AgentTool({ name: 'refund', description: 'refund' })
      async refund() {
        return { ok: true };
      }
    }

    const port = new InMemoryApprovalPort();
    port.setDecision('call_0:refund', { rejected: 'no' });

    const fake = new FakeModel([
      { toolCalls: [{ name: 'refund', input: {}, id: 'call_0' }] },
      'rejected path',
    ]);
    const ai = new AIEnhancedService();
    ai.registerProvider(fake);
    ai.registerTools(new Tools());
    ai.setApprovalPort(port);

    const res = await ai.complete(
      { messages: [{ role: 'user', content: 'x' }] },
      { modelName: 'default', tools: ['refund'], approve: ['refund'] }
    );
    expect(res.content).toContain('rejected');
    expect(res.finishReason).not.toBe('approval-required');
  });

  it('createHumanTaskCallCheckpointStore round-trips', async () => {
    const { createHumanTaskCallCheckpointStore } =
      await import('../approval/call-checkpoint-store');
    const map = new Map<
      string,
      { payload: import('../approval/call-checkpoint-store').CallCheckpoint }
    >();
    const store = createHumanTaskCallCheckpointStore({
      async create(task) {
        map.set(task.id, { payload: task.payload });
      },
      async get(id) {
        return map.get(id);
      },
      async complete(id) {
        map.delete(id);
      },
    });

    await store.save({
      id: 'cp1',
      createdAt: Date.now(),
      messages: [{ role: 'user', content: 'hi' }],
      request: {},
      config: {},
      resolved: { provider: 'openai', modelId: 'gpt-4o', fallback: [] },
      running: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      runningCost: 0,
      pendingToolCall: {
        id: 'c',
        type: 'function',
        function: { name: 't', arguments: '{}' },
      },
      pendingInput: {},
      approvalId: 'a',
      idempotencyKey: 'c:t',
    });
    expect((await store.get('cp1'))?.approvalId).toBe('a');
    await store.delete('cp1');
    expect(await store.get('cp1')).toBeUndefined();
  });
});
