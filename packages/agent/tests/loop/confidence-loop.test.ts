import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { AgentState } from '../../src/types/agent.types';
import { AgentEventType } from '../../src/types/event.types';
import type { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';

function mockLlm(responses: string[]): LLMProvider {
  let i = 0;
  return {
    async chat(_req: LLMChatRequest): Promise<LLMChatResponse> {
      const content = responses[Math.min(i, responses.length - 1)];
      i++;
      return { content, finishReason: 'stop' };
    },
  };
}

describe('Agent OS Phase 1 — state + loop', () => {
  @Agent({ name: 'loop-agent', description: 'Loop test agent', systemPrompt: 'You are helpful.' })
  class LoopAgent {}

  it('emits STATE_CHANGED via onStateChange', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(['hello']),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(LoopAgent);
    runtime.registerAgentInstance('loop-agent', new LoopAgent());

    const states: string[] = [];
    runtime.onStateChange((e) => {
      states.push((e.data as { newState: string }).newState);
    });

    await runtime.execute('loop-agent', 'hi', { maxSteps: 3 });
    expect(states.length).toBeGreaterThan(0);
    expect(states).toContain(AgentState.THINKING);
  });

  it('onState filters by state name', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(['ok']),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(LoopAgent);
    runtime.registerAgentInstance('loop-agent', new LoopAgent());

    let hit = 0;
    runtime.onState(AgentState.THINKING, () => {
      hit++;
    });
    await runtime.execute('loop-agent', 'hi', { maxSteps: 3 });
    expect(hit).toBeGreaterThan(0);
  });

  it('confidence loop returns loop metadata', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm([
        '1. Answer the user',
        'Final answer is 4',
        'score: 98\nfeedback: Looks good',
      ]),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(LoopAgent);
    runtime.registerAgentInstance('loop-agent', new LoopAgent());

    const loopEvents: string[] = [];
    runtime.on(AgentEventType.LOOP_COMPLETE, () => loopEvents.push('complete'));

    const result = await runtime.execute('loop-agent', 'What is 2+2?', {
      maxSteps: 3,
      loop: { maxIterations: 3, successScore: 95 },
    });

    expect(result.loop).toBeDefined();
    expect(result.loop!.success).toBe(true);
    expect(result.loop!.finalScore).toBeGreaterThanOrEqual(95);
    expect(loopEvents).toContain('complete');
  });

  it('records timeline steps', async () => {
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(['timeline response']),
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(LoopAgent);
    runtime.registerAgentInstance('loop-agent', new LoopAgent());

    await runtime.execute('loop-agent', 'hi', { maxSteps: 3 });
    const timeline = runtime.getTimeline({ agentName: 'loop-agent' });
    expect(timeline.length).toBeGreaterThan(0);
  });
});
