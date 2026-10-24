import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { AgentEventType } from '../../src/types/event.types';

function mockLlm(content = 'ok') {
  return { chat: jest.fn().mockResolvedValue({ content }) };
}

describe('AgentRuntime CAG / KAG / unified context', () => {
  it('emits CAG_CONTEXT_LOADED and KAG_QUERY_EXECUTED on successful execute', async () => {
    @Agent({
      name: 'cag-kag-ok-agent',
      description: 'CAG/KAG success',
      cagNamespace: 'ops',
      kagGraph: 'commerce',
      tenantId: 'acme',
    })
    class CagKagOkAgent {}

    const cagService = {
      getContext: jest.fn().mockResolvedValue({ context: { text: 'cached' }, hit: true }),
    };
    const kagService = {
      ask: jest
        .fn()
        .mockResolvedValue({ answer: 'graph hit', explanation: 'why', confidence: 0.8 }),
    };
    const ragService = { search: jest.fn().mockResolvedValue([{ content: 'rag' }]) };

    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      cagService,
      kagService,
      ragService,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(CagKagOkAgent);

    const events: string[] = [];
    runtime.on(AgentEventType.CAG_CONTEXT_LOADED as never, () => events.push('cag'));
    runtime.on(AgentEventType.KAG_QUERY_EXECUTED as never, () => events.push('kag'));

    await runtime.execute('cag-kag-ok-agent', 'q', { enableMemory: false });

    expect(cagService.getContext).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'ops', tenantId: 'acme' })
    );
    expect(kagService.ask).toHaveBeenCalledWith(
      'q',
      expect.objectContaining({ graph: 'commerce', tenantId: 'acme' })
    );
    expect(ragService.search).toHaveBeenCalled();
    expect(events).toEqual(expect.arrayContaining(['cag', 'kag']));
  });

  it('emits CAG_CONTEXT_FAILED and KAG_QUERY_FAILED when ports throw', async () => {
    @Agent({ name: 'cag-kag-fail-agent', description: 'CAG/KAG fail' })
    class CagKagFailAgent {}

    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      cagService: { getContext: jest.fn().mockRejectedValue(new Error('cag fail')) },
      kagService: { ask: jest.fn().mockRejectedValue(new Error('kag fail')) },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(CagKagFailAgent);

    const events: string[] = [];
    runtime.on(AgentEventType.CAG_CONTEXT_FAILED as never, () => events.push('cag-fail'));
    runtime.on(AgentEventType.KAG_QUERY_FAILED as never, () => events.push('kag-fail'));

    await runtime.execute('cag-kag-fail-agent', 'q', { enableMemory: false });
    expect(events).toEqual(expect.arrayContaining(['cag-fail', 'kag-fail']));
  });

  it('skips CAG/KAG when options or agent flags disable them', async () => {
    @Agent({
      name: 'cag-kag-disabled-agent',
      description: 'disabled',
      enableCAG: false,
      enableKAG: false,
    })
    class DisabledAgent {}

    const cagService = { getContext: jest.fn() };
    const kagService = { ask: jest.fn() };
    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      cagService,
      kagService,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(DisabledAgent);

    await runtime.execute('cag-kag-disabled-agent', 'q', { enableMemory: false });
    expect(cagService.getContext).not.toHaveBeenCalled();
    expect(kagService.ask).not.toHaveBeenCalled();

    @Agent({ name: 'cag-kag-opt-off-agent', description: 'opt off' })
    class OptOffAgent {}
    runtime.registerAgent(OptOffAgent);
    await runtime.execute('cag-kag-opt-off-agent', 'q', {
      enableMemory: false,
      enableCAG: false,
      enableKAG: false,
    });
    expect(cagService.getContext).not.toHaveBeenCalled();
    expect(kagService.ask).not.toHaveBeenCalled();
  });

  it('prefers contextService over individual CAG/RAG/KAG ports and emits CONTEXT_ASSEMBLED', async () => {
    @Agent({
      name: 'unified-context-agent',
      description: 'unified',
      cagNamespace: 'ops',
      tenantId: 'acme',
    })
    class UnifiedAgent {}

    const cagService = { getContext: jest.fn() };
    const kagService = { ask: jest.fn() };
    const ragService = { search: jest.fn() };
    const contextService = {
      assemble: jest.fn().mockResolvedValue({
        text: 'assembled',
        sourcesUsed: ['cag', 'kag'],
        plan: { rationale: ['prefer cache'] },
      }),
    };

    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      cagService,
      kagService,
      ragService,
      contextService,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(UnifiedAgent);

    const assembled: unknown[] = [];
    runtime.on(AgentEventType.CONTEXT_ASSEMBLED as never, (e) => assembled.push(e));

    await runtime.execute('unified-context-agent', 'q', { enableMemory: false });

    expect(contextService.assemble).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'acme', namespace: 'ops', query: 'q' })
    );
    expect(cagService.getContext).not.toHaveBeenCalled();
    expect(kagService.ask).not.toHaveBeenCalled();
    expect(ragService.search).not.toHaveBeenCalled();
    expect(assembled).toHaveLength(1);
  });

  it('emits CONTEXT_FAILED when the unified planner throws and skips assembled event on empty text', async () => {
    @Agent({ name: 'unified-fail-agent', description: 'fail' })
    class UnifiedFailAgent {}

    const failing = new AgentRuntime({
      llmProvider: mockLlm(),
      contextService: { assemble: jest.fn().mockRejectedValue(new Error('planner down')) },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    failing.registerAgent(UnifiedFailAgent);
    const failed: unknown[] = [];
    failing.on(AgentEventType.CONTEXT_FAILED as never, (e) => failed.push(e));
    await failing.execute('unified-fail-agent', 'q', { enableMemory: false });
    expect(failed).toHaveLength(1);

    @Agent({ name: 'unified-empty-agent', description: 'empty' })
    class UnifiedEmptyAgent {}
    const emptyRuntime = new AgentRuntime({
      llmProvider: mockLlm(),
      contextService: { assemble: jest.fn().mockResolvedValue({ text: '' }) },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    emptyRuntime.registerAgent(UnifiedEmptyAgent);
    const assembled: unknown[] = [];
    emptyRuntime.on(AgentEventType.CONTEXT_ASSEMBLED as never, (e) => assembled.push(e));
    await emptyRuntime.execute('unified-empty-agent', 'q', { enableMemory: false });
    expect(assembled).toHaveLength(0);
  });

  it('does not emit KAG_QUERY_EXECUTED when the graph returns no pieces', async () => {
    @Agent({ name: 'kag-empty-agent', description: 'empty kag' })
    class KagEmptyAgent {}

    const runtime = new AgentRuntime({
      llmProvider: mockLlm(),
      kagService: { ask: jest.fn().mockResolvedValue({ answer: '', explanation: '' }) },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(KagEmptyAgent);
    const queried: unknown[] = [];
    runtime.on(AgentEventType.KAG_QUERY_EXECUTED as never, (e) => queried.push(e));
    await runtime.execute('kag-empty-agent', 'q', { enableMemory: false });
    expect(queried).toHaveLength(0);
  });

  it('loads CAG/KAG and unified context on executeStream', async () => {
    @Agent({
      name: 'stream-cag-kag-agent',
      description: 'stream ports',
      cagNamespace: 'stream-ns',
      kagGraph: 'stream-graph',
      tenantId: 't1',
    })
    class StreamCagKagAgent {}

    const cagService = {
      getContext: jest.fn().mockResolvedValue({ context: { text: 'cached' } }),
    };
    const kagService = {
      ask: jest.fn().mockResolvedValue({ answer: 'hit' }),
    };
    const runtime = new AgentRuntime({
      llmProvider: {
        chat: jest.fn(),
        streamChat: jest.fn(async function* () {
          yield { content: 'tok' };
        }),
      },
      cagService,
      kagService,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(StreamCagKagAgent);

    const chunks = [];
    for await (const chunk of runtime.executeStream('stream-cag-kag-agent', 'hi', {
      enableMemory: false,
      streaming: true,
    })) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(cagService.getContext).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'stream-ns', tenantId: 't1' })
    );
    expect(kagService.ask).toHaveBeenCalledWith(
      'hi',
      expect.objectContaining({ graph: 'stream-graph', tenantId: 't1' })
    );

    @Agent({ name: 'stream-unified-agent', description: 'stream unified' })
    class StreamUnifiedAgent {}
    const contextService = {
      assemble: jest.fn().mockResolvedValue({ text: 'u' }),
    };
    const unifiedRuntime = new AgentRuntime({
      llmProvider: {
        chat: jest.fn(),
        streamChat: jest.fn(async function* () {
          yield { content: 'tok' };
        }),
      },
      cagService,
      kagService,
      contextService,
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    unifiedRuntime.registerAgent(StreamUnifiedAgent);
    for await (const _ of unifiedRuntime.executeStream('stream-unified-agent', 'hi', {
      enableMemory: false,
      streaming: true,
    })) {
      // drain
    }
    expect(contextService.assemble).toHaveBeenCalled();
    expect(cagService.getContext).toHaveBeenCalledTimes(1);
  });

  it('skips CAG/KAG on executeStream when flags are off', async () => {
    @Agent({
      name: 'stream-off-agent',
      description: 'off',
      enableCAG: false,
      enableKAG: false,
    })
    class StreamOffAgent {}

    const cagService = { getContext: jest.fn() };
    const kagService = { ask: jest.fn() };
    const runtime = new AgentRuntime({
      llmProvider: {
        chat: jest.fn(),
        streamChat: jest.fn(async function* () {
          yield { content: 'tok' };
        }),
      },
      cagService,
      kagService,
      ragService: { search: jest.fn().mockResolvedValue([]) },
      enableRetry: false,
      enableCircuitBreaker: false,
    });
    runtime.registerAgent(StreamOffAgent);
    for await (const _ of runtime.executeStream('stream-off-agent', 'hi', {
      enableMemory: false,
      streaming: true,
      enableRAG: false,
      enableCAG: false,
      enableKAG: false,
    })) {
      // drain
    }
    expect(cagService.getContext).not.toHaveBeenCalled();
    expect(kagService.ask).not.toHaveBeenCalled();
  });
});
