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

import type {
  A2ATask,
  A2ATaskSendParams,
  A2ATaskGetParams,
  A2ATaskCancelParams,
  A2ATaskState,
  A2AMessage,
  A2ATextPart,
  A2AStreamingEvent,
} from './a2a.types';

import type { AgentExecutionResult } from '../types/agent.types';

/** Minimal runtime interface to avoid circular deps */
interface RuntimeLike {
  execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  cancel(executionId: string): void;
  getContext(
    executionId: string
  ): Promise<{ executionId: string; state: string; steps: unknown[] } | undefined>;
  getAgents(): string[];
}

export interface A2AServerOptions {
  /** Default agent to use when no specific agent is targeted */
  defaultAgent?: string;
}

/**
 * A2A Protocol Server — handles JSON-RPC requests per the A2A spec
 */
export class A2AServer {
  /** In-memory task store. Replace with persistent store for production. */
  private tasks: Map<string, A2ATask> = new Map();
  /** Maps task IDs to execution IDs for cancel support */
  private taskExecutionMap: Map<string, string> = new Map();

  constructor(
    private readonly runtime: RuntimeLike,
    private readonly options: A2AServerOptions = {}
  ) {}

  // -------------------------------------------------------------------------
  // JSON-RPC Router
  // -------------------------------------------------------------------------

  async handleRequest(request: {
    jsonrpc?: string;
    method: string;
    id?: string | number | null;
    params?: unknown;
  }): Promise<{ jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: unknown }> {
    const id = request.id ?? null;

    try {
      switch (request.method) {
        case 'tasks/send':
          return {
            jsonrpc: '2.0',
            id,
            result: await this.handleTaskSend(request.params as A2ATaskSendParams),
          };

        case 'tasks/get':
          return {
            jsonrpc: '2.0',
            id,
            result: this.handleTaskGet(request.params as A2ATaskGetParams),
          };

        case 'tasks/cancel':
          return {
            jsonrpc: '2.0',
            id,
            result: await this.handleTaskCancel(request.params as A2ATaskCancelParams),
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          };
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : 'Internal error',
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // tasks/send
  // -------------------------------------------------------------------------

  private async handleTaskSend(params: A2ATaskSendParams): Promise<A2ATask> {
    const taskId = params.id;
    const input = this.extractTextFromMessage(params.message);

    // Determine which agent to execute
    const agentName = this.options.defaultAgent ?? this.runtime.getAgents()[0];
    if (!agentName) {
      throw new Error('No agent available to handle the task');
    }

    // Create the task record
    const task: A2ATask = {
      id: taskId,
      sessionId: params.sessionId,
      status: { state: 'submitted', timestamp: new Date().toISOString() },
      history: [params.message],
      metadata: params.metadata,
    };
    this.tasks.set(taskId, task);

    // Update to working state
    task.status = { state: 'working', timestamp: new Date().toISOString() };

    // Execute the agent
    const result = await this.runtime.execute(agentName, input, {
      sessionId: params.sessionId,
    });

    // Store the mapping for cancel support
    this.taskExecutionMap.set(taskId, result.executionId);

    // Map agent result to A2A task
    const agentMessage: A2AMessage = {
      role: 'agent',
      parts: [{ type: 'text', text: result.response ?? '' } as A2ATextPart],
    };

    task.status = {
      state: this.mapAgentStateToA2A(result.state),
      message: agentMessage,
      timestamp: new Date().toISOString(),
    };
    task.history = [...(task.history ?? []), agentMessage];

    if (result.response) {
      task.artifacts = [
        {
          parts: [{ type: 'text', text: result.response } as A2ATextPart],
          lastChunk: true,
        },
      ];
    }

    return task;
  }

  // -------------------------------------------------------------------------
  // tasks/get
  // -------------------------------------------------------------------------

  private handleTaskGet(params: A2ATaskGetParams): A2ATask {
    const task = this.tasks.get(params.id);
    if (!task) {
      throw new Error(`Task not found: ${params.id}`);
    }

    // Trim history if requested
    if (params.historyLength !== undefined && task.history) {
      const trimmed = { ...task };
      trimmed.history = task.history.slice(-params.historyLength);
      return trimmed;
    }

    return task;
  }

  // -------------------------------------------------------------------------
  // tasks/cancel
  // -------------------------------------------------------------------------

  private async handleTaskCancel(params: A2ATaskCancelParams): Promise<A2ATask> {
    const task = this.tasks.get(params.id);
    if (!task) {
      throw new Error(`Task not found: ${params.id}`);
    }

    // Cancel the underlying execution
    const executionId = this.taskExecutionMap.get(params.id);
    if (executionId) {
      this.runtime.cancel(executionId);
    }

    task.status = { state: 'canceled', timestamp: new Date().toISOString() };
    return task;
  }

  // -------------------------------------------------------------------------
  // tasks/sendSubscribe (streaming)
  // -------------------------------------------------------------------------

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
  async *handleTaskSendSubscribe(params: A2ATaskSendParams): AsyncGenerator<A2AStreamingEvent> {
    const taskId = params.id;
    const input = this.extractTextFromMessage(params.message);

    const agentName = this.options.defaultAgent ?? this.runtime.getAgents()[0];
    if (!agentName) {
      throw new Error('No agent available to handle the task');
    }

    // Create task record
    const task: A2ATask = {
      id: taskId,
      sessionId: params.sessionId,
      status: { state: 'submitted', timestamp: new Date().toISOString() },
      history: [params.message],
      metadata: params.metadata,
    };
    this.tasks.set(taskId, task);

    // Emit submitted status
    yield {
      type: 'status',
      event: { id: taskId, status: task.status, final: false },
    };

    // Update to working
    task.status = { state: 'working', timestamp: new Date().toISOString() };
    yield {
      type: 'status',
      event: { id: taskId, status: task.status, final: false },
    };

    // Execute and collect result
    const result = await this.runtime.execute(agentName, input, {
      sessionId: params.sessionId,
    });

    this.taskExecutionMap.set(taskId, result.executionId);

    // Emit artifact if there's a response
    if (result.response) {
      yield {
        type: 'artifact',
        event: {
          id: taskId,
          artifact: {
            parts: [{ type: 'text', text: result.response }],
            lastChunk: true,
          },
        },
      };
    }

    // Emit final status
    const finalState = this.mapAgentStateToA2A(result.state);
    const agentMessage: A2AMessage = {
      role: 'agent',
      parts: [{ type: 'text', text: result.response ?? '' }],
    };

    task.status = {
      state: finalState,
      message: agentMessage,
      timestamp: new Date().toISOString(),
    };
    task.history = [...(task.history ?? []), agentMessage];

    yield {
      type: 'status',
      event: { id: taskId, status: task.status, final: true },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private extractTextFromMessage(message: A2AMessage): string {
    return message.parts
      .filter((p): p is A2ATextPart => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
  }

  private mapAgentStateToA2A(state: string): A2ATaskState {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'waiting_for_input':
        return 'input-required';
      case 'waiting_for_approval':
        return 'input-required';
      case 'thinking':
      case 'using_tool':
        return 'working';
      default:
        return 'unknown';
    }
  }
}
