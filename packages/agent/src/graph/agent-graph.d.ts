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
import {
  GraphNode,
  GraphNodeConfig,
  GraphEdge,
  RouterFunction,
  GraphExecutionOptions,
  GraphExecutionResult,
  GraphStreamChunk,
} from './agent-graph.types';
import { AgentExecutionResult } from '../types/agent.types';
interface RuntimeLike {
  execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  getAgentMetadata(agentName: string):
    | {
        description?: string;
      }
    | undefined;
}
/**
 * Fluent builder for constructing a multi-agent graph.
 * Call `.compile()` to get an executable `CompiledGraph`.
 */
export declare class AgentGraph {
  private readonly graphId;
  private readonly runtime;
  private readonly nodes;
  private readonly edges;
  private entryPoint?;
  constructor(graphId: string, runtime: RuntimeLike);
  /**
   * Add a node to the graph.
   *
   * Node types:
   * - `'agent'`    — runs a named agent via AgentRuntime
   * - `'function'` — runs an arbitrary async function
   * - `'parallel'` — fans-out to multiple child nodes concurrently
   */
  addNode(id: string, config: GraphNodeConfig): this;
  /**
   * Add an unconditional directed edge from `from` → `to`.
   * Use `END` as the target to terminate the graph.
   */
  addEdge(from: string, to: string): this;
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
  ): this;
  /** Set the node where graph execution begins */
  setEntryPoint(nodeId: string): this;
  /**
   * Validate the graph and return an executable `CompiledGraph`.
   * Throws if the graph is malformed (missing entry point, dangling edges, etc.)
   */
  compile(): CompiledGraph;
}
/**
 * Executable graph produced by `AgentGraph.compile()`.
 */
export declare class CompiledGraph {
  private readonly graphId;
  private readonly nodes;
  private readonly edges;
  private readonly entryPoint;
  private readonly runtime;
  constructor(
    graphId: string,
    nodes: Map<string, GraphNode>,
    edges: GraphEdge[],
    entryPoint: string,
    runtime: RuntimeLike
  );
  /**
   * Execute the graph synchronously (collects all results before returning).
   */
  execute(input: string, options?: GraphExecutionOptions): Promise<GraphExecutionResult>;
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
  stream(input: string, options?: GraphExecutionOptions): AsyncGenerator<GraphStreamChunk>;
  private executeNode;
  private executeParallelBranches;
  private defaultMerge;
  private resolveNextNode;
  private applyPatch;
}
export {};
//# sourceMappingURL=agent-graph.d.ts.map
