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

import {
  SupervisorConfig,
  SupervisorResult,
  SupervisorRound,
  SupervisorDecision,
  SupervisorWorkerInfo,
} from '../graph/agent-graph.types';
import { AgentExecutionResult } from '../types/agent.types';
import { LLMProvider } from '../types/llm.types';

// Minimal runtime interface (avoids circular dependency with AgentRuntime)
interface RuntimeLike {
  execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  getAgentMetadata(agentName: string): { description?: string } | undefined;
}

/**
 * A supervisor that routes tasks to worker agents using an LLM.
 * Obtain one via `AgentRuntime.createSupervisor(config)`.
 */
export class SupervisorAgent {
  private readonly name: string;
  private readonly workers: string[];
  private readonly maxRounds: number;
  private readonly systemPrompt: string;
  private readonly model?: string;
  private readonly temperature: number;

  constructor(
    private readonly config: SupervisorConfig,
    private readonly llmProvider: LLMProvider,
    private readonly runtime: RuntimeLike
  ) {
    this.name = config.name;
    this.workers = config.workers;
    this.maxRounds = config.maxRounds ?? 10;
    this.temperature = config.temperature ?? 0;
    this.model = config.model;

    // Collect worker descriptions for the system prompt
    const workerInfos: SupervisorWorkerInfo[] = this.workers.map((w) => ({
      name: w,
      description: runtime.getAgentMetadata(w)?.description ?? `Worker agent: ${w}`,
    }));

    this.systemPrompt = config.systemPrompt
      ? `${config.systemPrompt}\n\n${this.buildWorkerList(workerInfos)}`
      : this.buildDefaultSystemPrompt(workerInfos);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run the supervisor on a given task.
   * The supervisor will iteratively route subtasks to workers until either:
   *  - The LLM decides the task is complete and emits a final response, or
   *  - `maxRounds` is reached (returns the accumulated context as the response).
   */
  async run(
    task: string,
    options: { sessionId?: string; userId?: string } = {}
  ): Promise<SupervisorResult> {
    const startTime = Date.now();
    const rounds: SupervisorRound[] = [];

    // Conversation context the supervisor maintains across rounds
    const conversationContext: string[] = [`Task: ${task}`];

    try {
      for (let round = 1; round <= this.maxRounds; round++) {
        const roundStart = Date.now();

        // Ask the LLM supervisor to decide what to do next
        const decision = await this.makeRoutingDecision(task, conversationContext);

        if (decision.action === 'finish') {
          const response = decision.response ?? conversationContext.join('\n\n');

          rounds.push({
            round,
            decision,
            duration: Date.now() - roundStart,
          });

          return {
            response,
            rounds,
            totalDuration: Date.now() - startTime,
            completedAt: new Date(),
            success: true,
          };
        }

        // Delegate to a worker agent
        if (decision.action === 'delegate' && decision.worker && decision.subtask) {
          if (!this.workers.includes(decision.worker)) {
            throw new Error(
              `Supervisor "${this.name}" tried to route to unknown worker "${decision.worker}". ` +
                `Available workers: ${this.workers.join(', ')}`
            );
          }

          const workerResult = await this.runtime.execute(decision.worker, decision.subtask, {
            sessionId: options.sessionId,
            userId: options.userId,
          });

          // Add the worker result to the conversation context
          conversationContext.push(
            `Round ${round} — Worker: ${decision.worker}\n` +
              `Subtask: ${decision.subtask}\n` +
              `Result: ${workerResult.response ?? '(no response)'}`
          );

          rounds.push({
            round,
            decision,
            workerResult,
            duration: Date.now() - roundStart,
          });

          continue;
        }

        // Unexpected decision shape — treat as finish
        rounds.push({ round, decision, duration: Date.now() - roundStart });
        break;
      }

      // maxRounds reached without a 'finish' decision
      const finalResponse =
        conversationContext.length > 1
          ? `Supervisor reached maximum rounds (${this.maxRounds}).\n\n` +
            conversationContext.slice(1).join('\n\n')
          : `Supervisor reached maximum rounds without producing a response.`;

      return {
        response: finalResponse,
        rounds,
        totalDuration: Date.now() - startTime,
        completedAt: new Date(),
        success: true,
      };
    } catch (error) {
      return {
        response: '',
        rounds,
        totalDuration: Date.now() - startTime,
        completedAt: new Date(),
        success: false,
        error: error as Error,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private: LLM routing
  // ---------------------------------------------------------------------------

  private async makeRoutingDecision(
    originalTask: string,
    context: string[]
  ): Promise<SupervisorDecision> {
    const contextSummary =
      context.length > 1 ? '\n\nWork completed so far:\n' + context.slice(1).join('\n\n') : '';

    const userMessage =
      `Original task: ${originalTask}${contextSummary}\n\n` +
      `Decide the next action. Respond with ONLY a JSON object (no markdown):
{
  "action": "delegate" | "finish",
  "worker": "<worker name>",    // required when action === "delegate"
  "subtask": "<instructions>",  // required when action === "delegate"
  "response": "<final answer>", // required when action === "finish"
  "thought": "<your reasoning>" // optional
}`;

    try {
      const llmResponse = await this.llmProvider.chat({
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: this.temperature,
        ...(this.model ? { model: this.model } : {}),
      });

      return this.parseDecision(llmResponse.content);
    } catch {
      // On LLM error, default to finishing with accumulated context
      return {
        action: 'finish',
        response: context.slice(1).join('\n\n') || 'Unable to complete task due to LLM error.',
        thought: 'LLM call failed, returning accumulated context.',
      };
    }
  }

  private parseDecision(raw: string): SupervisorDecision {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as SupervisorDecision;

      if (parsed.action !== 'delegate' && parsed.action !== 'finish') {
        return { action: 'finish', response: cleaned };
      }

      return parsed;
    } catch {
      // If the LLM returned plain text, treat it as a final answer
      return { action: 'finish', response: raw };
    }
  }

  // ---------------------------------------------------------------------------
  // Private: prompt builders
  // ---------------------------------------------------------------------------

  private buildDefaultSystemPrompt(workers: SupervisorWorkerInfo[]): string {
    return (
      `You are "${this.name}", a supervisor agent responsible for orchestrating a team of ` +
      `specialized worker agents to complete complex tasks.\n\n` +
      `Your responsibilities:\n` +
      `1. Break down the user's task into subtasks\n` +
      `2. Delegate each subtask to the most appropriate worker\n` +
      `3. Review worker results and decide what to do next\n` +
      `4. When all subtasks are done, synthesize a final response\n\n` +
      this.buildWorkerList(workers)
    );
  }

  private buildWorkerList(workers: SupervisorWorkerInfo[]): string {
    const lines = workers.map((w) => `  • ${w.name}: ${w.description}`);
    return `Available workers:\n${lines.join('\n')}`;
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  get supervisorName(): string {
    return this.name;
  }

  get workerNames(): string[] {
    return [...this.workers];
  }
}
