/**
 * Agent Executor
 * Core execution loop for agents
 */
import { AgentContext, AgentExecutionResult, AgentStreamChunk } from '../types/agent.types';
import { IAgentStateManager } from '../state/agent-state.interface';
import { AgentContextBuilder } from '../context/agent.context';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry } from '../registry/tool.registry';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import '../prompts/agent-system.prompt';
/** Options passed to execute() and executeStream() */
export interface AgentExecutorOptions {
    /** Execution timeout in ms. When exceeded, execution fails with AgentError (TIMEOUT). */
    timeoutMs?: number;
    /** AbortSignal to cancel execution. When aborted, fails with AgentError (CANCELLED). */
    signal?: AbortSignal;
    /** When true and LLM has streamChat, tokens are streamed in executeStream(). */
    streaming?: boolean;
}
/**
 * Agent Executor
 * Implements the core agent execution loop
 */
export declare class AgentExecutor {
    private stateManager;
    private contextBuilder;
    private toolExecutor;
    private toolRegistry;
    private llmProvider?;
    private eventEmitter?;
    constructor(stateManager: IAgentStateManager, contextBuilder: AgentContextBuilder, toolExecutor: ToolExecutor, toolRegistry: ToolRegistry, llmProvider?: LLMProvider | undefined, eventEmitter?: ((type: AgentEventType, executionId: string, data: unknown) => void) | undefined);
    /**
     * Helper to handle both sync and async state manager calls
     */
    private unwrap;
    private throwIfAborted;
    private throwIfTimeout;
    /**
     * Execute agent with controlled loop
     */
    execute(context: AgentContext, maxSteps?: number, options?: AgentExecutorOptions): Promise<AgentExecutionResult>;
    /**
     * Execute agent and stream step/token chunks when streaming is enabled.
     */
    executeStream(context: AgentContext, maxSteps?: number, options?: AgentExecutorOptions): AsyncGenerator<AgentStreamChunk>;
    /**
     * Execute a single step. Returns step and optional token chunks when streaming.
     */
    private executeStep;
    /**
     * Execute a single step with real-time token streaming.
     * Yields tokens as they arrive from the LLM instead of buffering them.
     */
    private executeStepStream;
    /**
     * Decide next action using LLM. Optionally streams and returns token chunks.
     */
    private decideNextAction;
    /**
     * Execute a tool
     */
    private executeTool;
    /**
     * Build prompt for LLM
     */
    private buildPrompt;
    /**
     * Resume execution after pause
     */
    resume(executionId: string, input?: string): Promise<AgentExecutionResult>;
    /**
     * Emit event
     */
    private emitEvent;
}
//# sourceMappingURL=agent.executor.d.ts.map