/**
 * Tests for AgentGraph, SupervisorAgent, and @Delegate decorator
 */

import 'reflect-metadata';
import { AgentGraph, CompiledGraph } from '../../src/graph/agent-graph';
import { END, GraphState, GraphExecutionResult } from '../../src/graph/agent-graph.types';
import { SupervisorAgent } from '../../src/supervisor/supervisor';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { Delegate, getDelegatedMethods, getDelegateMetadata } from '../../src/decorators/delegate.decorator';
import { AgentExecutionResult, AgentState } from '../../src/types/agent.types';
import { LLMProvider, LLMChatRequest, LLMChatResponse } from '../../src/types/llm.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgentResult(response: string): AgentExecutionResult {
  return {
    executionId: `exec_${Math.random().toString(36).slice(2)}`,
    agentId: 'test-agent',
    state: AgentState.COMPLETED,
    response,
    steps: [],
    metadata: {},
    duration: 10,
    completedAt: new Date(),
  };
}

/** Minimal RuntimeLike stub */
function makeRuntime(responses: Record<string, string> = {}) {
  return {
    execute: jest.fn(async (agentName: string, input: string) =>
      makeAgentResult(responses[agentName] ?? `${agentName} processed: ${input}`)
    ),
    getAgentMetadata: jest.fn((name: string) => ({ description: `Mock ${name}` })),
  };
}

// ---------------------------------------------------------------------------
// AgentGraph builder
// ---------------------------------------------------------------------------

describe('AgentGraph (builder)', () => {
  it('should create a graph with an entry point', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('test-graph', runtime);
    graph
      .addNode('node1', { type: 'agent', agentName: 'AgentA' })
      .addEdge('node1', END)
      .setEntryPoint('node1');

    expect(() => graph.compile()).not.toThrow();
  });

  it('should throw when compiling without an entry point', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('no-entry', runtime);
    graph.addNode('node1', { type: 'agent', agentName: 'AgentA' }).addEdge('node1', END);

    expect(() => graph.compile()).toThrow('has no entry point');
  });

  it('should throw when entry point does not exist', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('bad-entry', runtime);
    graph.setEntryPoint('missing-node');

    expect(() => graph.compile()).toThrow('"missing-node"');
  });

  it('should throw when an edge references an unknown node', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('bad-edge', runtime);
    graph
      .addNode('node1', { type: 'agent', agentName: 'AgentA' })
      .addEdge('node1', 'unknown-node')
      .setEntryPoint('node1');

    expect(() => graph.compile()).toThrow('unknown target node');
  });

  it('should throw when adding a node with the reserved END id', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('reserved-end', runtime);
    expect(() => graph.addNode(END, { type: 'function', fn: async (s) => s })).toThrow(
      'reserved'
    );
  });

  it('should throw when registering a duplicate node id', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('dup-node', runtime);
    graph.addNode('node1', { type: 'agent', agentName: 'AgentA' });
    expect(() => graph.addNode('node1', { type: 'agent', agentName: 'AgentB' })).toThrow(
      'already registered'
    );
  });

  it('should throw when a parallel node references an unknown branch', () => {
    const runtime = makeRuntime();
    const graph = new AgentGraph('bad-parallel', runtime);
    graph
      .addNode('p', { type: 'parallel', branches: ['missing-branch'] })
      .addEdge('p', END)
      .setEntryPoint('p');

    expect(() => graph.compile()).toThrow('unknown branch node');
  });
});

// ---------------------------------------------------------------------------
// CompiledGraph.execute() — sequential
// ---------------------------------------------------------------------------

describe('CompiledGraph — sequential execution', () => {
  it('should run a simple agent node and return its response', async () => {
    const runtime = makeRuntime({ ResearchAgent: 'LLMs are transformer-based models.' });

    const result: GraphExecutionResult = await new AgentGraph('simple', runtime)
      .addNode('researcher', { type: 'agent', agentName: 'ResearchAgent' })
      .addEdge('researcher', END)
      .setEntryPoint('researcher')
      .compile()
      .execute('Explain LLMs');

    expect(result.success).toBe(true);
    expect(result.response).toBe('LLMs are transformer-based models.');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].nodeId).toBe('researcher');
    expect(runtime.execute).toHaveBeenCalledWith('ResearchAgent', 'Explain LLMs', expect.any(Object));
  });

  it('should chain two agent nodes sequentially', async () => {
    const runtime = makeRuntime({
      ResearchAgent: 'Research findings: LLMs use attention.',
      WriterAgent: 'Article: LLMs use attention mechanisms.',
    });

    // The writer receives the researcher's output as input
    const result = await new AgentGraph('pipeline', runtime)
      .addNode('researcher', {
        type: 'agent',
        agentName: 'ResearchAgent',
      })
      .addNode('writer', {
        type: 'agent',
        agentName: 'WriterAgent',
        inputMapper: (state) => state.output ?? state.input,
      })
      .addEdge('researcher', 'writer')
      .addEdge('writer', END)
      .setEntryPoint('researcher')
      .compile()
      .execute('Write about LLMs');

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].nodeId).toBe('researcher');
    expect(result.steps[1].nodeId).toBe('writer');
    // Writer should have received the researcher's output
    expect(runtime.execute).toHaveBeenNthCalledWith(
      2,
      'WriterAgent',
      'Research findings: LLMs use attention.',
      expect.any(Object)
    );
  });

  it('should run a function node and merge the patch', async () => {
    const runtime = makeRuntime();

    const result = await new AgentGraph('fn-graph', runtime)
      .addNode('prep', {
        type: 'function',
        fn: (state) => ({ data: { prepared: true }, output: `Prepared: ${state.input}` }),
      })
      .addEdge('prep', END)
      .setEntryPoint('prep')
      .compile()
      .execute('hello');

    expect(result.success).toBe(true);
    expect(result.state.data.prepared).toBe(true);
    expect(result.state.output).toBe('Prepared: hello');
  });

  it('should apply outputMapper on agent nodes', async () => {
    const runtime = makeRuntime({ AgentA: 'raw output' });

    const result = await new AgentGraph('mapper', runtime)
      .addNode('a', {
        type: 'agent',
        agentName: 'AgentA',
        outputMapper: (res, state) => ({
          output: `TRANSFORMED: ${res.response}`,
          data: { ...state.data, transformed: true },
        }),
      })
      .addEdge('a', END)
      .setEntryPoint('a')
      .compile()
      .execute('test');

    expect(result.state.output).toBe('TRANSFORMED: raw output');
    expect(result.state.data.transformed).toBe(true);
  });

  it('should respect maxSteps and return an error result', async () => {
    const runtime = makeRuntime({ LoopAgent: 'still going' });

    // Node A → Node A (infinite loop) — should be cut off
    const result = await new AgentGraph('looping', runtime)
      .addNode('a', { type: 'agent', agentName: 'LoopAgent' })
      .addConditionalEdge('a', () => 'a') // always loops back
      .setEntryPoint('a')
      .compile()
      .execute('loop me', { maxSteps: 3 });

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/maxSteps/);
  });
});

// ---------------------------------------------------------------------------
// CompiledGraph.execute() — conditional routing
// ---------------------------------------------------------------------------

describe('CompiledGraph — conditional routing', () => {
  it('should route to the correct node based on state', async () => {
    const runtime = makeRuntime({
      CoderAgent: 'Here is some code',
      WriterAgent: 'Here is some prose',
    });

    const compiled = new AgentGraph('conditional', runtime)
      .addNode('classifier', {
        type: 'function',
        fn: (state) => ({
          data: { type: state.input.includes('code') ? 'code' : 'write' },
        }),
      })
      .addNode('coder', { type: 'agent', agentName: 'CoderAgent' })
      .addNode('writer', { type: 'agent', agentName: 'WriterAgent' })
      .setEntryPoint('classifier')
      .addConditionalEdge('classifier', (state) =>
        state.data.type === 'code' ? 'coder' : 'writer'
      )
      .addEdge('coder', END)
      .addEdge('writer', END)
      .compile();

    const codeResult = await compiled.execute('Write some code for me');
    expect(codeResult.response).toBe('Here is some code');
    expect(runtime.execute).toHaveBeenCalledWith('CoderAgent', expect.any(String), expect.any(Object));

    jest.clearAllMocks();

    const writeResult = await compiled.execute('Write an essay about AI');
    expect(writeResult.response).toBe('Here is some prose');
    expect(runtime.execute).toHaveBeenCalledWith('WriterAgent', expect.any(String), expect.any(Object));
  });

  it('should route to END directly from a conditional edge', async () => {
    const runtime = makeRuntime();

    const result = await new AgentGraph('skip-graph', runtime)
      .addNode('gate', {
        type: 'function',
        fn: (state) => ({ data: { skip: true }, output: 'Skipped via gate' }),
      })
      .setEntryPoint('gate')
      .addConditionalEdge('gate', () => END)
      .compile()
      .execute('trigger skip');

    expect(result.success).toBe(true);
    expect(result.response).toBe('Skipped via gate');
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it('should support routeMap shorthand', async () => {
    const runtime = makeRuntime({
      AgentX: 'X response',
      AgentY: 'Y response',
    });

    const result = await new AgentGraph('routemap', runtime)
      .addNode('router-fn', {
        type: 'function',
        fn: (state) => ({ data: { route: 'x' } }),
      })
      .addNode('node-x', { type: 'agent', agentName: 'AgentX' })
      .addNode('node-y', { type: 'agent', agentName: 'AgentY' })
      .setEntryPoint('router-fn')
      .addConditionalEdge(
        'router-fn',
        (state) => state.data.route as string,
        { x: 'node-x', y: 'node-y' }
      )
      .addEdge('node-x', END)
      .addEdge('node-y', END)
      .compile()
      .execute('test routeMap');

    expect(result.response).toBe('X response');
  });
});

// ---------------------------------------------------------------------------
// CompiledGraph.execute() — parallel execution
// ---------------------------------------------------------------------------

describe('CompiledGraph — parallel execution', () => {
  it('should execute parallel branches concurrently and merge results', async () => {
    const callOrder: string[] = [];
    const runtime = {
      execute: jest.fn(async (agentName: string, input: string) => {
        callOrder.push(agentName);
        return makeAgentResult(`${agentName} result`);
      }),
      getAgentMetadata: jest.fn(() => ({})),
    };

    const result = await new AgentGraph('parallel', runtime)
      .addNode('researcher-a', { type: 'agent', agentName: 'ResearcherA' })
      .addNode('researcher-b', { type: 'agent', agentName: 'ResearcherB' })
      .addNode('parallel-search', {
        type: 'parallel',
        branches: ['researcher-a', 'researcher-b'],
      })
      .addEdge('parallel-search', END)
      .setEntryPoint('parallel-search')
      .compile()
      .execute('Research topic');

    expect(result.success).toBe(true);
    expect(result.state.nodeResults['researcher-a']).toBeDefined();
    expect(result.state.nodeResults['researcher-b']).toBeDefined();
    expect(result.state.output).toContain('ResearcherA result');
    expect(result.state.output).toContain('ResearcherB result');
    expect(runtime.execute).toHaveBeenCalledTimes(2);
  });

  it('should continue to a downstream node after parallel branches', async () => {
    const runtime = makeRuntime({
      BranchA: 'A done',
      BranchB: 'B done',
      CombinerAgent: 'Combined: A done + B done',
    });

    const result = await new AgentGraph('parallel-then-combine', runtime)
      .addNode('branch-a', { type: 'agent', agentName: 'BranchA' })
      .addNode('branch-b', { type: 'agent', agentName: 'BranchB' })
      .addNode('parallel-step', { type: 'parallel', branches: ['branch-a', 'branch-b'] })
      .addNode('combiner', {
        type: 'agent',
        agentName: 'CombinerAgent',
        inputMapper: (state) => state.output ?? state.input,
      })
      .addEdge('parallel-step', 'combiner')
      .addEdge('combiner', END)
      .setEntryPoint('parallel-step')
      .compile()
      .execute('run parallel then combine');

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2); // parallel-step + combiner
    expect(result.steps[0].nodeId).toBe('parallel-step');
    expect(result.steps[1].nodeId).toBe('combiner');
  });

  it('should use a custom mergeStrategy when provided', async () => {
    const runtime = makeRuntime({ AgentP: 'p-result', AgentQ: 'q-result' });

    const result = await new AgentGraph('custom-merge', runtime)
      .addNode('p', { type: 'agent', agentName: 'AgentP' })
      .addNode('q', { type: 'agent', agentName: 'AgentQ' })
      .addNode('par', {
        type: 'parallel',
        branches: ['p', 'q'],
        mergeStrategy: (results, base) => ({
          output: results.map((r) => r.agentResult?.response).join(' | '),
          data: { ...base.data, merged: true },
        }),
      })
      .addEdge('par', END)
      .setEntryPoint('par')
      .compile()
      .execute('merge test');

    expect(result.state.data.merged).toBe(true);
    expect(result.state.output).toContain('p-result');
    expect(result.state.output).toContain('q-result');
  });
});

// ---------------------------------------------------------------------------
// CompiledGraph.stream()
// ---------------------------------------------------------------------------

describe('CompiledGraph — streaming', () => {
  it('should yield a chunk per node and a terminal done=true chunk', async () => {
    const runtime = makeRuntime({ AgentA: 'chunk A', AgentB: 'chunk B' });

    const graph = new AgentGraph('stream-test', runtime)
      .addNode('a', { type: 'agent', agentName: 'AgentA' })
      .addNode('b', { type: 'agent', agentName: 'AgentB' })
      .addEdge('a', 'b')
      .addEdge('b', END)
      .setEntryPoint('a')
      .compile();

    const chunks = [];
    for await (const chunk of graph.stream('stream me')) {
      chunks.push(chunk);
    }

    const doneChunk = chunks[chunks.length - 1];
    expect(doneChunk.done).toBe(true);

    const nodeIds = chunks.map((c) => c.nodeId);
    expect(nodeIds).toContain('a');
    expect(nodeIds).toContain('b');
  });
});

// ---------------------------------------------------------------------------
// SupervisorAgent
// ---------------------------------------------------------------------------

describe('SupervisorAgent', () => {
  function makeLLM(responses: string[]): LLMProvider {
    let callCount = 0;
    return {
      chat: jest.fn(async (_req: LLMChatRequest): Promise<LLMChatResponse> => {
        const response = responses[callCount] ?? responses[responses.length - 1];
        callCount++;
        return { content: response, finishReason: 'stop' };
      }),
    };
  }

  it('should delegate to a worker and finish in two rounds', async () => {
    const runtime = makeRuntime({ ResearchAgent: 'LLMs use attention mechanisms.' });

    const supervisorLLM = makeLLM([
      JSON.stringify({ action: 'delegate', worker: 'ResearchAgent', subtask: 'Explain LLMs' }),
      JSON.stringify({ action: 'finish', response: 'Summary: LLMs use attention.' }),
    ]);

    const supervisor = new SupervisorAgent(
      { name: 'test-supervisor', workers: ['ResearchAgent', 'WriterAgent'], maxRounds: 5 },
      supervisorLLM,
      runtime
    );

    const result = await supervisor.run('Explain LLMs');

    expect(result.success).toBe(true);
    expect(result.response).toBe('Summary: LLMs use attention.');
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0].decision.action).toBe('delegate');
    expect(result.rounds[0].decision.worker).toBe('ResearchAgent');
    expect(result.rounds[1].decision.action).toBe('finish');
    expect(runtime.execute).toHaveBeenCalledWith('ResearchAgent', 'Explain LLMs', expect.any(Object));
  });

  it('should handle a direct finish in round 1 without delegating', async () => {
    const runtime = makeRuntime();

    const supervisorLLM = makeLLM([
      JSON.stringify({ action: 'finish', response: 'I can answer this directly.' }),
    ]);

    const supervisor = new SupervisorAgent(
      { name: 'direct-supervisor', workers: ['AgentA'], maxRounds: 5 },
      supervisorLLM,
      runtime
    );

    const result = await supervisor.run('Simple question?');

    expect(result.success).toBe(true);
    expect(result.response).toBe('I can answer this directly.');
    expect(result.rounds).toHaveLength(1);
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it('should stop after maxRounds and return accumulated context', async () => {
    const runtime = makeRuntime({ AgentA: 'partial result' });

    // Always returns delegate — never finishes
    const supervisorLLM = makeLLM([
      JSON.stringify({ action: 'delegate', worker: 'AgentA', subtask: 'do something' }),
    ]);

    const supervisor = new SupervisorAgent(
      { name: 'maxrounds-supervisor', workers: ['AgentA'], maxRounds: 2 },
      supervisorLLM,
      runtime
    );

    const result = await supervisor.run('Endless task');

    expect(result.success).toBe(true);
    expect(result.rounds).toHaveLength(2);
    expect(result.response).toMatch(/maximum rounds/i);
  });

  it('should throw when routing to an unknown worker', async () => {
    const runtime = makeRuntime();

    const supervisorLLM = makeLLM([
      JSON.stringify({ action: 'delegate', worker: 'UnknownAgent', subtask: 'do it' }),
    ]);

    const supervisor = new SupervisorAgent(
      { name: 'bad-route', workers: ['AgentA'], maxRounds: 3 },
      supervisorLLM,
      runtime
    );

    const result = await supervisor.run('Task');

    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/unknown worker/i);
  });

  it('should handle malformed LLM JSON gracefully by treating it as finish', async () => {
    const runtime = makeRuntime();

    const supervisorLLM = makeLLM(['This is not JSON at all.']);

    const supervisor = new SupervisorAgent(
      { name: 'bad-json', workers: ['AgentA'], maxRounds: 2 },
      supervisorLLM,
      runtime
    );

    const result = await supervisor.run('Task');

    expect(result.success).toBe(true);
    expect(result.response).toContain('This is not JSON');
  });

  it('should expose workerNames and supervisorName', () => {
    const runtime = makeRuntime();
    const supervisor = new SupervisorAgent(
      { name: 'my-supervisor', workers: ['A', 'B'] },
      { chat: jest.fn() },
      runtime
    );

    expect(supervisor.supervisorName).toBe('my-supervisor');
    expect(supervisor.workerNames).toEqual(['A', 'B']);
  });
});

// ---------------------------------------------------------------------------
// @Delegate decorator
// ---------------------------------------------------------------------------

describe('@Delegate decorator', () => {
  it('should store delegate metadata on the method', () => {
    @Agent({ name: 'host-agent', description: 'Host' })
    class HostAgent {
      @Delegate({ agent: 'TargetAgent', description: 'Runs TargetAgent', inputField: 'query' })
      async doResearch(_query: string): Promise<string> {
        return '';
      }
    }

    const meta = getDelegateMetadata(HostAgent.prototype, 'doResearch');
    expect(meta).toBeDefined();
    expect(meta!.agent).toBe('TargetAgent');
    expect(meta!.description).toBe('Runs TargetAgent');
    expect(meta!.inputField).toBe('query');
  });

  it('should list the method in getDelegatedMethods', () => {
    @Agent({ name: 'list-agent', description: 'List' })
    class ListAgent {
      @Delegate({ agent: 'AgentA', description: 'A' })
      async doA(_input: string): Promise<string> { return ''; }

      @Delegate({ agent: 'AgentB', description: 'B' })
      async doB(_input: string): Promise<string> { return ''; }
    }

    const methods = getDelegatedMethods(ListAgent);
    expect(methods).toContain('doA');
    expect(methods).toContain('doB');
  });

  it('should be patched to call the runtime when registered', async () => {
    @Agent({ name: 'orchestrator-patch', description: 'Orchestrator' })
    class OrchestratorAgent {
      @Delegate({ agent: 'WorkerAgent', description: 'Does the work', inputField: 'task' })
      async delegateWork(_task: string): Promise<string> {
        return ''; // replaced at runtime
      }
    }

    const workerResult = makeAgentResult('worker done!');
    const mockLLM: LLMProvider = {
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({ action: 'finish', response: 'done' }),
      }),
    };

    @Agent({ name: 'WorkerAgent', description: 'Worker' })
    class WorkerAgent {
      @Tool({ description: 'does work' })
      async work(input: string): Promise<string> {
        return `worked: ${input}`;
      }
    }

    const runtime = new AgentRuntime({ llmProvider: mockLLM });
    runtime.registerAgent(OrchestratorAgent);
    runtime.registerAgent(WorkerAgent);

    const orchestratorInstance = new OrchestratorAgent();
    const workerInstance = new WorkerAgent();

    // Spy on runtime.execute so we can intercept the delegate call
    jest
      .spyOn(runtime, 'execute')
      .mockResolvedValue(workerResult);

    runtime.registerAgentInstance('orchestrator-patch', orchestratorInstance);
    runtime.registerAgentInstance('WorkerAgent', workerInstance);

    // The patched method should call runtime.execute
    const patched = (orchestratorInstance as unknown as Record<string, Function>)['delegateWork'];
    const response = await patched({ task: 'hello' });

    expect(response).toBe('worker done!');
    expect(runtime.execute).toHaveBeenCalledWith('WorkerAgent', 'hello');
  });
});

// ---------------------------------------------------------------------------
// AgentRuntime.createGraph() and AgentRuntime.createSupervisor()
// ---------------------------------------------------------------------------

describe('AgentRuntime factory methods', () => {
  it('createGraph() should return an AgentGraph bound to the runtime', () => {
    const runtime = new AgentRuntime();
    const graph = runtime.createGraph('my-graph');

    expect(graph).toBeInstanceOf(AgentGraph);
  });

  it('createSupervisor() should throw if no LLM provider is configured', () => {
    const runtime = new AgentRuntime(); // no llmProvider

    expect(() =>
      runtime.createSupervisor({ name: 'sup', workers: ['AgentA'] })
    ).toThrow('LLM provider');
  });

  it('createSupervisor() should return a SupervisorAgent when LLM is configured', () => {
    const mockLLM: LLMProvider = { chat: jest.fn() };
    const runtime = new AgentRuntime({ llmProvider: mockLLM });

    const supervisor = runtime.createSupervisor({ name: 'sup', workers: ['AgentA'] });

    expect(supervisor).toBeInstanceOf(SupervisorAgent);
    expect(supervisor.supervisorName).toBe('sup');
  });

  it('spawn() should call execute() with the same arguments', async () => {
    const mockLLM: LLMProvider = { chat: jest.fn() };
    const runtime = new AgentRuntime({ llmProvider: mockLLM });

    @Agent({ name: 'spawn-test-agent', description: 'Spawn test' })
    class SpawnTestAgent {}

    runtime.registerAgent(SpawnTestAgent);

    jest.spyOn(runtime, 'execute').mockResolvedValue(makeAgentResult('spawned'));

    const result = await runtime.spawn('spawn-test-agent', 'do something');

    expect(result.response).toBe('spawned');
    expect(runtime.execute).toHaveBeenCalledWith('spawn-test-agent', 'do something', {});
  });
});
