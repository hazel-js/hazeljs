"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompiledGraph = exports.AgentGraph = void 0;
const crypto_1 = require("crypto");
const agent_graph_types_1 = require("./agent-graph.types");
// ---------------------------------------------------------------------------
// AgentGraph (builder)
// ---------------------------------------------------------------------------
/**
 * Fluent builder for constructing a multi-agent graph.
 * Call `.compile()` to get an executable `CompiledGraph`.
 */
class AgentGraph {
    constructor(graphId, runtime) {
        this.graphId = graphId;
        this.runtime = runtime;
        this.nodes = new Map();
        this.edges = [];
        // Register the sentinel END node
        this.nodes.set(agent_graph_types_1.END, { id: agent_graph_types_1.END, config: { type: 'function', fn: (s) => s } });
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
    addNode(id, config) {
        if (id === agent_graph_types_1.END) {
            throw new Error(`"${agent_graph_types_1.END}" is a reserved node ID`);
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
    addEdge(from, to) {
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
    addConditionalEdge(from, routerFn, routeMap) {
        const condition = routeMap
            ? (state) => {
                const key = routerFn(state);
                return routeMap[key] ?? key;
            }
            : routerFn;
        this.edges.push({ from, condition });
        return this;
    }
    /** Set the node where graph execution begins */
    setEntryPoint(nodeId) {
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
    compile() {
        if (!this.entryPoint) {
            throw new Error(`Graph "${this.graphId}" has no entry point. Call setEntryPoint() first.`);
        }
        if (!this.nodes.has(this.entryPoint)) {
            throw new Error(`Entry point "${this.entryPoint}" is not a registered node in graph "${this.graphId}"`);
        }
        // Validate all edge references
        for (const edge of this.edges) {
            if (!this.nodes.has(edge.from)) {
                throw new Error(`Edge references unknown source node: "${edge.from}"`);
            }
            if (edge.to && edge.to !== agent_graph_types_1.END && !this.nodes.has(edge.to)) {
                throw new Error(`Edge references unknown target node: "${edge.to}"`);
            }
        }
        // Validate parallel branch references
        for (const [, node] of this.nodes) {
            if (node.config.type === 'parallel') {
                for (const branch of node.config.branches) {
                    if (!this.nodes.has(branch)) {
                        throw new Error(`Parallel node "${node.id}" references unknown branch node: "${branch}"`);
                    }
                }
            }
        }
        return new CompiledGraph(this.graphId, new Map(this.nodes), [...this.edges], this.entryPoint, this.runtime);
    }
}
exports.AgentGraph = AgentGraph;
// ---------------------------------------------------------------------------
// CompiledGraph (executor)
// ---------------------------------------------------------------------------
/**
 * Executable graph produced by `AgentGraph.compile()`.
 */
class CompiledGraph {
    constructor(graphId, nodes, edges, entryPoint, runtime) {
        this.graphId = graphId;
        this.nodes = nodes;
        this.edges = edges;
        this.entryPoint = entryPoint;
        this.runtime = runtime;
    }
    // -------------------------------------------------------------------------
    // execute()
    // -------------------------------------------------------------------------
    /**
     * Execute the graph synchronously (collects all results before returning).
     */
    async execute(input, options = {}) {
        const executionId = `graph_${(0, crypto_1.randomUUID)()}`;
        const startTime = Date.now();
        const steps = [];
        const nodeExecutions = {};
        let state = {
            input,
            messages: [{ role: 'user', content: input, timestamp: new Date() }],
            data: { ...(options.initialData ?? {}) },
            nodeResults: {},
            metadata: { executionId, graphId: this.graphId, ...options },
        };
        const maxSteps = options.maxSteps ?? 50;
        const timeout = options.timeout ?? 600000;
        const deadline = Date.now() + timeout;
        let currentNodeId = this.entryPoint;
        let stepCount = 0;
        try {
            while (currentNodeId !== agent_graph_types_1.END) {
                if (Date.now() > deadline) {
                    throw new Error(`Graph "${this.graphId}" exceeded timeout of ${timeout}ms after ${stepCount} steps`);
                }
                if (stepCount >= maxSteps) {
                    throw new Error(`Graph "${this.graphId}" exceeded maxSteps (${maxSteps}). Possible infinite loop.`);
                }
                stepCount++;
                const node = this.nodes.get(currentNodeId);
                if (!node) {
                    throw new Error(`Node "${currentNodeId}" not found in graph "${this.graphId}"`);
                }
                state = { ...state, currentNode: currentNodeId };
                const stepStart = Date.now();
                const { nextState, agentResult, parallelBranches } = await this.executeNode(node, state, options);
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
        }
        catch (error) {
            return {
                graphId: this.graphId,
                executionId,
                state: { ...state, error: error },
                steps,
                nodeExecutions,
                duration: Date.now() - startTime,
                completedAt: new Date(),
                success: false,
                error: error,
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
    async *stream(input, options = {}) {
        const executionId = `graph_${(0, crypto_1.randomUUID)()}`;
        const maxSteps = options.maxSteps ?? 50;
        const timeout = options.timeout ?? 600000;
        const deadline = Date.now() + timeout;
        let state = {
            input,
            messages: [{ role: 'user', content: input, timestamp: new Date() }],
            data: { ...(options.initialData ?? {}) },
            nodeResults: {},
            metadata: { executionId, graphId: this.graphId, ...options },
        };
        let currentNodeId = this.entryPoint;
        let stepCount = 0;
        while (currentNodeId !== agent_graph_types_1.END) {
            if (Date.now() > deadline || stepCount >= maxSteps)
                break;
            stepCount++;
            const node = this.nodes.get(currentNodeId);
            if (!node)
                break;
            state = { ...state, currentNode: currentNodeId };
            const { nextState, agentResult, parallelBranches } = await this.executeNode(node, state, options);
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
            nodeId: currentNodeId === agent_graph_types_1.END ? agent_graph_types_1.END : currentNodeId,
            nodeType: 'function',
            chunk: state.output ?? '',
            nodeOutput: state.output,
            done: true,
        };
    }
    // -------------------------------------------------------------------------
    // Node execution
    // -------------------------------------------------------------------------
    async executeNode(node, state, options) {
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
            let patch;
            if (config.outputMapper) {
                patch = config.outputMapper(result, state);
            }
            else {
                const newMessage = {
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
            let patch;
            if (config.mergeStrategy) {
                patch = config.mergeStrategy(branchResults, state);
            }
            else {
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
    async executeParallelBranches(branchIds, state, options) {
        const tasks = branchIds.map(async (nodeId) => {
            const node = this.nodes.get(nodeId);
            if (!node) {
                return { nodeId, state, error: new Error(`Branch node "${nodeId}" not found`) };
            }
            try {
                const { nextState, agentResult } = await this.executeNode(node, state, options);
                return { nodeId, state: nextState, agentResult };
            }
            catch (err) {
                return { nodeId, state, error: err };
            }
        });
        return Promise.all(tasks);
    }
    defaultMerge(results, base) {
        const messages = [...base.messages];
        const nodeResults = { ...base.nodeResults };
        const data = { ...base.data };
        const outputs = [];
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
    resolveNextNode(fromNodeId, state) {
        const edge = this.edges.find((e) => e.from === fromNodeId);
        if (!edge)
            return agent_graph_types_1.END;
        if (edge.condition) {
            return edge.condition(state);
        }
        return edge.to ?? agent_graph_types_1.END;
    }
    // -------------------------------------------------------------------------
    // State helpers
    // -------------------------------------------------------------------------
    applyPatch(state, patch) {
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
exports.CompiledGraph = CompiledGraph;
