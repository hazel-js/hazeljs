/**
 * SupervisorAgent — Orchestrate a team of worker agents via an LLM router
 *
 * The supervisor uses an LLM to:
 *  1. Decompose an incoming task into subtasks
 *  2. Route each subtask to the most appropriate worker agent
 *  3. Accumulate results and decide when the task is complete
 *
 * This implements the "Supervisor ↔ Workers" multi-agent pattern:
 *
 * ```
 *   User Task
 *       │
 *   Supervisor  ←───────────────────────┐
 *       │                               │
 *   ┌───▼────────────────┐         Worker result
 *   │  Route to worker?  │              │
 *   └───────────┬────────┘              │
 *               │                       │
 *        ┌──────▼──────┐                │
 *        │  WorkerAgent │───────────────┘
 *        └─────────────┘
 * ```
 *
 * @example
 * ```ts
 * const supervisor = runtime.createSupervisor({
 *   name: 'project-manager',
 *   workers: ['ResearchAgent', 'CoderAgent', 'WriterAgent'],
 *   maxRounds: 6,
 * });
 *
 * const result = await supervisor.run('Build a REST API for a todo app');
 * console.log(result.response);
 * ```
 */
import { SupervisorConfig, SupervisorResult } from '../graph/agent-graph.types';
import { AgentExecutionResult } from '../types/agent.types';
import { LLMProvider } from '../types/llm.types';
import '../prompts/supervisor-system.prompt';
import '../prompts/supervisor-routing.prompt';
interface RuntimeLike {
    execute(agentName: string, input: string, options?: Record<string, unknown>): Promise<AgentExecutionResult>;
    getAgentMetadata(agentName: string): {
        description?: string;
    } | undefined;
}
/**
 * A supervisor that routes tasks to worker agents using an LLM.
 * Obtain one via `AgentRuntime.createSupervisor(config)`.
 */
export declare class SupervisorAgent {
    private readonly config;
    private readonly llmProvider;
    private readonly runtime;
    private readonly name;
    private readonly workers;
    private readonly maxRounds;
    private readonly systemPrompt;
    private readonly model?;
    private readonly temperature;
    constructor(config: SupervisorConfig, llmProvider: LLMProvider, runtime: RuntimeLike);
    /**
     * Run the supervisor on a given task.
     * The supervisor will iteratively route subtasks to workers until either:
     *  - The LLM decides the task is complete and emits a final response, or
     *  - `maxRounds` is reached (returns the accumulated context as the response).
     */
    run(task: string, options?: {
        sessionId?: string;
        userId?: string;
    }): Promise<SupervisorResult>;
    private makeRoutingDecision;
    private parseDecision;
    private buildDefaultSystemPrompt;
    private buildWorkerList;
    get supervisorName(): string;
    get workerNames(): string[];
}
export {};
//# sourceMappingURL=supervisor.d.ts.map