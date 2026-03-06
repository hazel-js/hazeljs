/**
 * AgentGraph — Multi-Agent Orchestration Graph
 *
 * Provides a LangGraph-inspired DAG runtime for orchestrating multiple agents.
 * Supports sequential pipelines, conditional routing, and parallel fan-out/fan-in.
 *
 * @example Sequential pipeline
 * ```ts
 * const graph = runtime.createGraph('pipeline')
 *   .addNode('researcher', { type: 'agent', agentName: 'ResearchAgent' })
 *   .addNode('writer',     { type: 'agent', agentName: 'WriterAgent' })
 *   .addEdge('researcher', 'writer')
 *   .addEdge('writer', END)
 *   .setEntryPoint('researcher')
 *   .compile();
 *
 * const result = await graph.execute('Write a blog about LLMs');
 * ```
 *
 * @example Conditional routing
 * ```ts
 * const graph = runtime.createGraph('router')
 *   .addNode('classifier', { type: 'agent', agentName: 'ClassifierAgent' })
 *   .addNode('coder',      { type: 'agent', agentName: 'CoderAgent' })
 *   .addNode('writer',     { type: 'agent', agentName: 'WriterAgent' })
 *   .setEntryPoint('classifier')
 *   .addConditionalEdge('classifier', state => state.data.type === 'code' ? 'coder' : 'writer')
 *   .addEdge('coder',  END)
 *   .addEdge('writer', END)
 *   .compile();
 * ```
 *
 * @example Parallel fan-out / fan-in
 * ```ts
 * const graph = runtime.createGraph('parallel')
 *   .addNode('splitter',    { type: 'function', fn: splitTask })
 *   .addNode('parallel-1', { type: 'parallel', branches: ['agent-a', 'agent-b'] })
 *   .addNode('agent-a',    { type: 'agent', agentName: 'AgentA' })
 *   .addNode('agent-b',    { type: 'agent', agentName: 'AgentB' })
 *   .addNode('combiner',   { type: 'function', fn: combineResults })
 *   .addEdge('splitter',   'parallel-1')
 *   .addEdge('parallel-1', 'combiner')
 *   .addEdge('combiner',    END)
 *   .setEntryPoint('splitter')
 *   .compile();
 * ```
 */

import { randomUUID } from 'crypto';
import {
  END,
  GraphState,
  GraphNode,
  GraphNodeConfig,
  GraphEdge,
  RouterFunction,
  GraphExecutionOptions,
  GraphExecutionResult,
  GraphStep,
  GraphStreamChunk,
  ParallelBranchResult,
  GraphMessage,
} from './agent-graph.types';
import { AgentExecutionResult } from '../types/agent.types';

// Forward-reference to avoid circular deps at runtime
// AgentRuntime is passed in as a plain object matching this minimal interface.
interface RuntimeLike {
  execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  getAgentMetadata(agentName: string): { description?: string } | undefined;
}

// ---------------------------------------------------------------------------
// AgentGraph (builder)
// ---------------------------------------------------------------------------

/**
 * Fluent builder for constructing a multi-agent graph.
 * Call `.compile()` to get an executable `CompiledGraph`.
 */
export class AgentGraph {
  private readonly nodes: Map<string, GraphNode> = new Map();
  private readonly edges: GraphEdge[] = [];
  private entryPoint?: string;

  constructor(
    private readonly graphId: string,
    private readonly runtime: RuntimeLike
  ) {
    // Register the sentinel END node
    this.nodes.set(END, { id: END, config: { type: 'function', fn: (s) => s } });
  }

  // -------------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------------

  /**
   * Add a node to the graph.
   *
   * Node types:
   * - `'agent'`    — runs a named agent via AgentRuntime
   * - `'function'` — runs an arbitrary async function
   * - `'parallel'` — fans-out to multiple child nodes concurrently
   */
  addNode(id: string, config: GraphNodeConfig): this {
    if (id === END) {
      throw new Error(`"${END}" is a reserved node ID`);
    }
    if (this.nodes.has(id)) {
      throw new Error(`Node "${id}" is already registered in graph "${this.graphId}"`);
    }
    this.nodes.set(id, { id, config });
    return this;
  }

  // -------------------------------------------------------------------------
  // Edges
  // -------------------------------------------------------------------------

  /**
   * Add an unconditional directed edge from `from` → `to`.
   * Use `END` as the target to terminate the graph.
   */
  addEdge(from: string, to: string): this {
    this.edges.push({ from, to });
    return this;
  }

  /**
   * Add a conditional edge from `from`.
   * The `routerFn` inspects the current `GraphState` and returns the ID of
   * the next node (or `END` to stop).
   *
   * @param routeMap Optional mapping of routerFn return values to node IDs,
   *                 so you can use short keys like `'code'` → `'CoderNode'`.
   */
  addConditionalEdge(
    from: string,
    routerFn: RouterFunction,
    routeMap?: Record<string, string>
  ): this {
    const condition: RouterFunction = routeMap
      ? (state): string => {
          const key = routerFn(state) as string;
          return routeMap[key] ?? key;
        }
      : routerFn;

    this.edges.push({ from, condition });
    return this;
  }

  /** Set the node where graph execution begins */
  setEntryPoint(nodeId: string): this {
    this.entryPoint = nodeId;
    return this;
  }

  // -------------------------------------------------------------------------
  // Compile
  // -------------------------------------------------------------------------

  /**
   * Validate the graph and return an executable `CompiledGraph`.
   * Throws if the graph is malformed (missing entry point, dangling edges, etc.)
   */
  compile(): CompiledGraph {
    if (!this.entryPoint) {
      throw new Error(`Graph "${this.graphId}" has no entry point. Call setEntryPoint() first.`);
    }
    if (!this.nodes.has(this.entryPoint)) {
      throw new Error(
        `Entry point "${this.entryPoint}" is not a registered node in graph "${this.graphId}"`
      );
    }

    // Validate all edge references
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new Error(`Edge references unknown source node: "${edge.from}"`);
      }
      if (edge.to && edge.to !== END && !this.nodes.has(edge.to)) {
        throw new Error(`Edge references unknown target node: "${edge.to}"`);
      }
    }

    // Validate parallel branch references
    for (const [, node] of this.nodes) {
      if (node.config.type === 'parallel') {
        for (const branch of node.config.branches) {
          if (!this.nodes.has(branch)) {
            throw new Error(
              `Parallel node "${node.id}" references unknown branch node: "${branch}"`
            );
          }
        }
      }
    }

    return new CompiledGraph(
      this.graphId,
      new Map(this.nodes),
      [...this.edges],
      this.entryPoint,
      this.runtime
    );
  }
}

// ---------------------------------------------------------------------------
// CompiledGraph (executor)
// ---------------------------------------------------------------------------

/**
 * Executable graph produced by `AgentGraph.compile()`.
 */
export class CompiledGraph {
  constructor(
    private readonly graphId: string,
    private readonly nodes: Map<string, GraphNode>,
    private readonly edges: GraphEdge[],
    private readonly entryPoint: string,
    private readonly runtime: RuntimeLike
  ) {}

  // -------------------------------------------------------------------------
  // execute()
  // -------------------------------------------------------------------------

  /**
   * Execute the graph synchronously (collects all results before returning).
   */
  async execute(input: string, options: GraphExecutionOptions = {}): Promise<GraphExecutionResult> {
    const executionId = `graph_${randomUUID()}`;
    const startTime = Date.now();
    const steps: GraphStep[] = [];
    const nodeExecutions: Record<string, AgentExecutionResult> = {};

    let state: GraphState = {
      input,
      messages: [{ role: 'user', content: input, timestamp: new Date() }],
      data: { ...(options.initialData ?? {}) },
      nodeResults: {},
      metadata: { executionId, graphId: this.graphId, ...options },
    };

    const maxSteps = options.maxSteps ?? 50;
    const timeout = options.timeout ?? 600_000;
    const deadline = Date.now() + timeout;

    let currentNodeId: string = this.entryPoint;
    let stepCount = 0;

    try {
      while (currentNodeId !== END) {
        if (Date.now() > deadline) {
          throw new Error(
            `Graph "${this.graphId}" exceeded timeout of ${timeout}ms after ${stepCount} steps`
          );
        }
        if (stepCount >= maxSteps) {
          throw new Error(
            `Graph "${this.graphId}" exceeded maxSteps (${maxSteps}). Possible infinite loop.`
          );
        }

        stepCount++;
        const node = this.nodes.get(currentNodeId);
        if (!node) {
          throw new Error(`Node "${currentNodeId}" not found in graph "${this.graphId}"`);
        }

        state = { ...state, currentNode: currentNodeId };
        const stepStart = Date.now();

        const { nextState, agentResult, parallelBranches } = await this.executeNode(
          node,
          state,
          options
        );
        state = nextState;

        if (agentResult) {
          nodeExecutions[currentNodeId] = agentResult;
          state = { ...state, nodeResults: { ...state.nodeResults, [currentNodeId]: agentResult } };
        }

        steps.push({
          id: `step_${stepCount}`,
          nodeId: currentNodeId,
          nodeType: node.config.type,
          input: state.input,
          output: state.output,
          duration: Date.now() - stepStart,
          timestamp: new Date(),
          parallelBranches,
        });

        currentNodeId = this.resolveNextNode(currentNodeId, state);
      }

      return {
        graphId: this.graphId,
        executionId,
        state,
        response: state.output,
        steps,
        nodeExecutions,
        duration: Date.now() - startTime,
        completedAt: new Date(),
        success: true,
      };
    } catch (error) {
      return {
        graphId: this.graphId,
        executionId,
        state: { ...state, error: error as Error },
        steps,
        nodeExecutions,
        duration: Date.now() - startTime,
        completedAt: new Date(),
        success: false,
        error: error as Error,
      };
    }
  }

  // -------------------------------------------------------------------------
  // stream()
  // -------------------------------------------------------------------------

  /**
   * Execute the graph and yield a `GraphStreamChunk` after each node completes.
   * Useful for streaming progress updates to the client in real-time.
   *
   * @example
   * ```ts
   * for await (const chunk of graph.stream('Research LLMs')) {
   *   console.log(`[${chunk.nodeId}]`, chunk.chunk);
   * }
   * ```
   */
  async *stream(
    input: string,
    options: GraphExecutionOptions = {}
  ): AsyncGenerator<GraphStreamChunk> {
    const executionId = `graph_${randomUUID()}`;
    const maxSteps = options.maxSteps ?? 50;
    const timeout = options.timeout ?? 600_000;
    const deadline = Date.now() + timeout;

    let state: GraphState = {
      input,
      messages: [{ role: 'user', content: input, timestamp: new Date() }],
      data: { ...(options.initialData ?? {}) },
      nodeResults: {},
      metadata: { executionId, graphId: this.graphId, ...options },
    };

    let currentNodeId: string = this.entryPoint;
    let stepCount = 0;

    while (currentNodeId !== END) {
      if (Date.now() > deadline || stepCount >= maxSteps) break;

      stepCount++;
      const node = this.nodes.get(currentNodeId);
      if (!node) break;

      state = { ...state, currentNode: currentNodeId };

      const { nextState, agentResult, parallelBranches } = await this.executeNode(
        node,
        state,
        options
      );
      state = nextState;

      if (agentResult) {
        state = {
          ...state,
          nodeResults: { ...state.nodeResults, [currentNodeId]: agentResult },
        };
      }

      yield {
        executionId,
        nodeId: currentNodeId,
        nodeType: node.config.type,
        chunk: state.output ?? '',
        nodeOutput: state.output,
        done: false,
      };

      if (parallelBranches) {
        for (const branch of parallelBranches) {
          yield {
            executionId,
            nodeId: branch,
            nodeType: 'agent',
            chunk: state.nodeResults[branch]?.response ?? '',
            nodeOutput: state.nodeResults[branch]?.response,
            done: false,
          };
        }
      }

      currentNodeId = this.resolveNextNode(currentNodeId, state);
    }

    yield {
      executionId,
      nodeId: currentNodeId === END ? END : currentNodeId,
      nodeType: 'function',
      chunk: state.output ?? '',
      nodeOutput: state.output,
      done: true,
    };
  }

  // -------------------------------------------------------------------------
  // Node execution
  // -------------------------------------------------------------------------

  private async executeNode(
    node: GraphNode,
    state: GraphState,
    options: GraphExecutionOptions
  ): Promise<{
    nextState: GraphState;
    agentResult?: AgentExecutionResult;
    parallelBranches?: string[];
  }> {
    const config = node.config;

    // -- function node --
    if (config.type === 'function') {
      const patch = await config.fn(state);
      return { nextState: this.applyPatch(state, patch) };
    }

    // -- agent node --
    if (config.type === 'agent') {
      const agentInput = config.inputMapper ? config.inputMapper(state) : state.input;

      const result = await this.runtime.execute(config.agentName, agentInput, {
        sessionId: options.sessionId,
        userId: options.userId,
      });

      let patch: Partial<GraphState>;
      if (config.outputMapper) {
        patch = config.outputMapper(result, state);
      } else {
        const newMessage: GraphMessage = {
          role: 'assistant',
          content: result.response ?? '',
          nodeId: node.id,
          timestamp: new Date(),
        };
        patch = {
          output: result.response,
          messages: [...state.messages, newMessage],
        };
      }

      return {
        nextState: this.applyPatch(state, patch),
        agentResult: result,
      };
    }

    // -- parallel node --
    if (config.type === 'parallel') {
      const branchResults = await this.executeParallelBranches(config.branches, state, options);

      // Apply custom merge or default
      let patch: Partial<GraphState>;
      if (config.mergeStrategy) {
        patch = config.mergeStrategy(branchResults, state);
      } else {
        patch = this.defaultMerge(branchResults, state);
      }

      return {
        nextState: this.applyPatch(state, patch),
        parallelBranches: config.branches,
      };
    }

    return { nextState: state };
  }

  // -------------------------------------------------------------------------
  // Parallel execution helpers
  // -------------------------------------------------------------------------

  private async executeParallelBranches(
    branchIds: string[],
    state: GraphState,
    options: GraphExecutionOptions
  ): Promise<ParallelBranchResult[]> {
    const tasks = branchIds.map(async (nodeId): Promise<ParallelBranchResult> => {
      const node = this.nodes.get(nodeId);
      if (!node) {
        return { nodeId, state, error: new Error(`Branch node "${nodeId}" not found`) };
      }
      try {
        const { nextState, agentResult } = await this.executeNode(node, state, options);
        return { nodeId, state: nextState, agentResult };
      } catch (err) {
        return { nodeId, state, error: err as Error };
      }
    });

    return Promise.all(tasks);
  }

  private defaultMerge(results: ParallelBranchResult[], base: GraphState): Partial<GraphState> {
    const messages: GraphMessage[] = [...base.messages];
    const nodeResults: Record<string, AgentExecutionResult> = { ...base.nodeResults };
    const data: Record<string, unknown> = { ...base.data };
    const outputs: string[] = [];

    for (const r of results) {
      if (r.agentResult) {
        nodeResults[r.nodeId] = r.agentResult;
        if (r.agentResult.response) {
          outputs.push(`[${r.nodeId}]: ${r.agentResult.response}`);
          messages.push({
            role: 'assistant',
            content: r.agentResult.response,
            nodeId: r.nodeId,
            timestamp: new Date(),
          });
        }
      }
      // Merge data from parallel states (last-write wins for conflicts)
      Object.assign(data, r.state.data);
    }

    return {
      output: outputs.join('\n\n---\n\n'),
      messages,
      nodeResults,
      data,
    };
  }

  // -------------------------------------------------------------------------
  // Edge resolution
  // -------------------------------------------------------------------------

  private resolveNextNode(fromNodeId: string, state: GraphState): string {
    const edge = this.edges.find((e) => e.from === fromNodeId);
    if (!edge) return END;

    if (edge.condition) {
      return edge.condition(state) as string;
    }

    return (edge.to as string) ?? END;
  }

  // -------------------------------------------------------------------------
  // State helpers
  // -------------------------------------------------------------------------

  private applyPatch(state: GraphState, patch: Partial<GraphState>): GraphState {
    return {
      ...state,
      ...patch,
      // Always deep-merge these collections rather than replacing them
      data: { ...state.data, ...(patch.data ?? {}) },
      nodeResults: { ...state.nodeResults, ...(patch.nodeResults ?? {}) },
      messages: patch.messages ?? state.messages,
    };
  }
}
