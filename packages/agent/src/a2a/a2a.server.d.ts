/**
 * A2A Server Adapter
 *
 * Maps A2A JSON-RPC protocol methods to HazelJS AgentRuntime execution.
 *
 * Supported methods:
 *   tasks/send          — Execute an agent and return the result
 *   tasks/get           — Get task status and history
 *   tasks/cancel        — Cancel a running task
 *   tasks/sendSubscribe — Stream task progress via SSE
 *
 * @example Express integration:
 * ```ts
 * import { A2AServer, buildAgentCard } from '@hazeljs/agent';
 *
 * const a2a = new A2AServer(runtime, { defaultAgent: 'SupportAgent' });
 *
 * // Serve agent card
 * app.get('/.well-known/agent.json', (req, res) => {
 *   res.json(buildAgentCard(runtime, { url: 'https://api.example.com/a2a' }));
 * });
 *
 * // Handle A2A JSON-RPC
 * app.post('/a2a', async (req, res) => {
 *   const result = await a2a.handleRequest(req.body);
 *   res.json(result);
 * });
 * ```
 */
import type { A2ATaskSendParams, A2AStreamingEvent } from './a2a.types';
import type { AgentExecutionResult } from '../types/agent.types';
/** Minimal runtime interface to avoid circular deps */
interface RuntimeLike {
    execute(agentName: string, input: string, options?: Record<string, unknown>): Promise<AgentExecutionResult>;
    cancel(executionId: string): void;
    getContext(executionId: string): Promise<{
        executionId: string;
        state: string;
        steps: unknown[];
    } | undefined>;
    getAgents(): string[];
}
export interface A2AServerOptions {
    /** Default agent to use when no specific agent is targeted */
    defaultAgent?: string;
}
/**
 * A2A Protocol Server — handles JSON-RPC requests per the A2A spec
 */
export declare class A2AServer {
    private readonly runtime;
    private readonly options;
    /** In-memory task store. Replace with persistent store for production. */
    private tasks;
    /** Maps task IDs to execution IDs for cancel support */
    private taskExecutionMap;
    constructor(runtime: RuntimeLike, options?: A2AServerOptions);
    handleRequest(request: {
        jsonrpc?: string;
        method: string;
        id?: string | number | null;
        params?: unknown;
    }): Promise<{
        jsonrpc: '2.0';
        id: string | number | null;
        result?: unknown;
        error?: unknown;
    }>;
    private handleTaskSend;
    private handleTaskGet;
    private handleTaskCancel;
    /**
     * Stream task execution via an async generator.
     * The caller should convert these events to SSE format.
     *
     * @example Express SSE:
     * ```ts
     * app.post('/a2a/stream', async (req, res) => {
     *   res.setHeader('Content-Type', 'text/event-stream');
     *   for await (const event of a2a.handleTaskSendSubscribe(req.body.params)) {
     *     res.write(`data: ${JSON.stringify(event)}\n\n`);
     *   }
     *   res.end();
     * });
     * ```
     */
    handleTaskSendSubscribe(params: A2ATaskSendParams): AsyncGenerator<A2AStreamingEvent>;
    private extractTextFromMessage;
    private mapAgentStateToA2A;
}
export {};
//# sourceMappingURL=a2a.server.d.ts.map