/**
 * Agent Executor
 * Core execution loop for agents
 */

import { randomUUID } from 'crypto';
import {
  AgentContext,
  AgentState,
  AgentStep,
  AgentAction,
  AgentActionType,
  AgentStepResult,
  AgentExecutionResult,
  AgentStreamChunk,
} from '../types/agent.types';
import { IAgentStateManager } from '../state/agent-state.interface';
import { AgentContextBuilder } from '../context/agent.context';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry } from '../registry/tool.registry';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import { PromptRegistry } from '@hazeljs/prompts';
import { AgentError } from '../errors/agent.error';
import '../prompts/agent-system.prompt';
import { AGENT_SYSTEM_KEY } from '../prompts/agent-system.prompt';

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
export class AgentExecutor {
  constructor(
    private stateManager: IAgentStateManager,
    private contextBuilder: AgentContextBuilder,
    private toolExecutor: ToolExecutor,
    private toolRegistry: ToolRegistry,
    private llmProvider?: LLMProvider,
    private eventEmitter?: (type: AgentEventType, executionId: string, data: unknown) => void
  ) {}

  /**
   * Helper to handle both sync and async state manager calls
   */
  private async unwrap<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? await value : value;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw AgentError.cancelled();
    }
  }

  private throwIfTimeout(deadline: number): void {
    if (Date.now() > deadline) {
      throw AgentError.timeout();
    }
  }

  /**
   * Execute agent with controlled loop
   */
  async execute(
    context: AgentContext,
    maxSteps: number = 10,
    options: AgentExecutorOptions = {}
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs;
    const signal = options.signal;
    const deadline = timeoutMs != null ? startTime + timeoutMs : undefined;

    try {
      this.throwIfAborted(signal);

      this.emitEvent(AgentEventType.EXECUTION_STARTED, context.executionId, {
        input: context.input,
        sessionId: context.sessionId,
        userId: context.userId,
        options: context.metadata,
      });

      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.THINKING));

      let stepNumber = 0;
      let finalResponse: string | undefined;

      while (await this.unwrap(this.stateManager.canContinue(context.executionId, maxSteps))) {
        if (deadline != null) this.throwIfTimeout(deadline);
        this.throwIfAborted(signal);

        stepNumber++;

        const { step } = await this.executeStep(context, stepNumber, signal);
        await this.unwrap(this.stateManager.addStep(context.executionId, step));

        if (step.state === AgentState.COMPLETED) {
          finalResponse = step.action?.response;
          break;
        }

        if (step.state === AgentState.FAILED) {
          throw step.error || new Error('Step failed without error');
        }

        if (step.state === AgentState.WAITING_FOR_APPROVAL) {
          await this.unwrap(
            this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_APPROVAL)
          );
          break;
        }

        if (step.state === AgentState.WAITING_FOR_INPUT) {
          await this.unwrap(
            this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_INPUT)
          );
          break;
        }
      }

      if (stepNumber >= maxSteps) {
        await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.FAILED));
        throw AgentError.maxSteps(maxSteps);
      }

      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.COMPLETED));

      const duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.EXECUTION_COMPLETED, context.executionId, {
        response: finalResponse,
        steps: stepNumber,
        duration,
      });

      return {
        executionId: context.executionId,
        agentId: context.agentId,
        state: AgentState.COMPLETED,
        response: finalResponse,
        steps: context.steps,
        metadata: context.metadata,
        duration,
        completedAt: new Date(),
      };
    } catch (error) {
      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.FAILED));

      const duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.EXECUTION_FAILED, context.executionId, {
        error: error as Error,
        step: context.steps.length,
        duration,
      });

      return {
        executionId: context.executionId,
        agentId: context.agentId,
        state: AgentState.FAILED,
        error: error as Error,
        steps: context.steps,
        metadata: context.metadata,
        duration,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Execute agent and stream step/token chunks when streaming is enabled.
   */
  async *executeStream(
    context: AgentContext,
    maxSteps: number = 10,
    options: AgentExecutorOptions = {}
  ): AsyncGenerator<AgentStreamChunk> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs;
    const signal = options.signal;
    const deadline = timeoutMs != null ? startTime + timeoutMs : undefined;
    const streaming = !!(options.streaming && this.llmProvider?.streamChat);

    try {
      this.throwIfAborted(signal);

      this.emitEvent(AgentEventType.EXECUTION_STARTED, context.executionId, {
        input: context.input,
        sessionId: context.sessionId,
        userId: context.userId,
        options: context.metadata,
      });

      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.THINKING));

      let stepNumber = 0;
      let finalResponse: string | undefined;

      while (await this.unwrap(this.stateManager.canContinue(context.executionId, maxSteps))) {
        if (deadline != null) this.throwIfTimeout(deadline);
        this.throwIfAborted(signal);

        stepNumber++;

        // Stream tokens in real-time if streaming is enabled
        if (streaming) {
          let step: AgentStep | undefined;
          for await (const chunk of this.executeStepStream(context, stepNumber, signal)) {
            if (chunk.type === 'step') {
              step = chunk.step;
              yield { type: 'step', step };
            } else if (chunk.type === 'token') {
              yield { type: 'token', content: chunk.content };
            }
          }
          if (!step) throw new Error('No step returned from executeStepStream');
          await this.unwrap(this.stateManager.addStep(context.executionId, step));

          if (step.state === AgentState.COMPLETED) {
            finalResponse = step.action?.response;
            break;
          }
          if (step.state === AgentState.FAILED) {
            throw step.error || new Error('Step failed without error');
          }
          if (step.state === AgentState.WAITING_FOR_APPROVAL) {
            await this.unwrap(
              this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_APPROVAL)
            );
            break;
          }
          if (step.state === AgentState.WAITING_FOR_INPUT) {
            await this.unwrap(
              this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_INPUT)
            );
            break;
          }
          continue;
        }

        // Non-streaming path
        const stepResult = await this.executeStep(context, stepNumber, signal, streaming);
        const { step, tokenChunks } = stepResult;

        yield { type: 'step', step };
        if (tokenChunks) {
          for (const content of tokenChunks) {
            yield { type: 'token', content };
          }
        }

        await this.unwrap(this.stateManager.addStep(context.executionId, step));

        if (step.state === AgentState.COMPLETED) {
          finalResponse = step.action?.response;
          break;
        }

        if (step.state === AgentState.FAILED) {
          throw step.error || new Error('Step failed without error');
        }

        if (step.state === AgentState.WAITING_FOR_APPROVAL) {
          await this.unwrap(
            this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_APPROVAL)
          );
          break;
        }

        if (step.state === AgentState.WAITING_FOR_INPUT) {
          await this.unwrap(
            this.stateManager.updateState(context.executionId, AgentState.WAITING_FOR_INPUT)
          );
          break;
        }
      }

      if (stepNumber >= maxSteps) {
        await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.FAILED));
        throw AgentError.maxSteps(maxSteps);
      }

      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.COMPLETED));

      const duration = Date.now() - startTime;
      const result: AgentExecutionResult = {
        executionId: context.executionId,
        agentId: context.agentId,
        state: AgentState.COMPLETED,
        response: finalResponse,
        steps: context.steps,
        metadata: context.metadata,
        duration,
        completedAt: new Date(),
      };

      this.emitEvent(AgentEventType.EXECUTION_COMPLETED, context.executionId, {
        response: finalResponse,
        steps: stepNumber,
        duration,
      });

      yield { type: 'done', result };
    } catch (error) {
      await this.unwrap(this.stateManager.updateState(context.executionId, AgentState.FAILED));

      const duration = Date.now() - startTime;
      const result: AgentExecutionResult = {
        executionId: context.executionId,
        agentId: context.agentId,
        state: AgentState.FAILED,
        error: error as Error,
        steps: context.steps,
        metadata: context.metadata,
        duration,
        completedAt: new Date(),
      };

      this.emitEvent(AgentEventType.EXECUTION_FAILED, context.executionId, {
        error: error as Error,
        step: context.steps.length,
        duration,
      });

      yield { type: 'done', result };
    }
  }

  /**
   * Execute a single step. Returns step and optional token chunks when streaming.
   */
  private async executeStep(
    context: AgentContext,
    stepNumber: number,
    signal?: AbortSignal,
    streaming?: boolean
  ): Promise<{ step: AgentStep; tokenChunks?: string[] }> {
    const stepId = randomUUID();
    const startTime = Date.now();

    const step: AgentStep = {
      id: stepId,
      agentId: context.agentId,
      executionId: context.executionId,
      stepNumber,
      state: AgentState.THINKING,
      timestamp: new Date(),
    };

    this.emitEvent(AgentEventType.STEP_STARTED, context.executionId, {
      stepNumber,
      state: step.state,
    });

    try {
      this.throwIfAborted(signal);
      const { action, tokenChunks } = await this.decideNextAction(context, { signal, streaming });
      step.action = action;

      switch (action.type) {
        case AgentActionType.USE_TOOL:
          step.state = AgentState.USING_TOOL;
          step.result = await this.executeTool(context, action);
          break;

        case AgentActionType.ASK_USER:
          step.state = AgentState.WAITING_FOR_INPUT;
          this.emitEvent(AgentEventType.USER_INPUT_REQUESTED, context.executionId, {
            question: action.question,
          });
          break;

        case AgentActionType.RESPOND:
          step.state = AgentState.COMPLETED;
          step.result = {
            success: true,
            output: action.response,
          };
          break;

        case AgentActionType.WAIT:
          step.state = AgentState.WAITING_FOR_APPROVAL;
          break;

        case AgentActionType.COMPLETE:
          step.state = AgentState.COMPLETED;
          step.result = {
            success: true,
            output: action.response,
          };
          break;

        default:
          step.state = AgentState.THINKING;
      }

      step.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.STEP_COMPLETED, context.executionId, {
        stepNumber,
        state: step.state,
        action,
        result: step.result,
      });

      return { step, tokenChunks };
    } catch (error) {
      step.state = AgentState.FAILED;
      step.error = error as Error;
      step.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.STEP_FAILED, context.executionId, {
        stepNumber,
        state: step.state,
        error: (error as Error).message,
      });

      return { step };
    }
  }

  /**
   * Execute a single step with real-time token streaming.
   * Yields tokens as they arrive from the LLM instead of buffering them.
   */
  private async *executeStepStream(
    context: AgentContext,
    stepNumber: number,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStreamChunk> {
    const stepId = randomUUID();
    const startTime = Date.now();

    const step: AgentStep = {
      id: stepId,
      agentId: context.agentId,
      executionId: context.executionId,
      stepNumber,
      state: AgentState.THINKING,
      timestamp: new Date(),
    };

    this.emitEvent(AgentEventType.STEP_STARTED, context.executionId, {
      stepNumber,
      state: step.state,
    });

    try {
      this.throwIfAborted(signal);

      // Build the LLM request
      const prompt = this.buildPrompt(context);
      const tools = this.toolRegistry.getToolDefinitionsForLLM(context.agentId);
      const messages = [
        { role: 'system' as const, content: prompt.system },
        ...prompt.messages,
        { role: 'user' as const, content: context.input },
      ];
      const request = {
        messages,
        tools: tools.length > 0 ? tools : undefined,
      };

      const streamChat = this.llmProvider?.streamChat;

      if (streamChat) {
        let content = '';

        // Stream tokens in real-time by directly forwarding chunks
        const stream = streamChat(request);

        for await (const chunk of stream) {
          if (signal) this.throwIfAborted(signal);
          if (chunk.content) {
            content += chunk.content;
            // Yield token immediately - each yield returns control to caller
            yield { type: 'token', content: chunk.content };
            // Force microtask to allow immediate processing
            await Promise.resolve();
          }
        }

        // After streaming completes, create the action
        step.action = {
          type: AgentActionType.RESPOND,
          response: content,
        };
        step.state = AgentState.COMPLETED;
        step.result = {
          success: true,
          output: content,
        };
      } else if (this.llmProvider) {
        // Fallback to non-streaming
        const response = await this.llmProvider.chat(request);
        step.action = {
          type: AgentActionType.RESPOND,
          response: response.content,
        };
        step.state = AgentState.COMPLETED;
        step.result = {
          success: true,
          output: response.content,
        };
      } else {
        // No LLM provider
        step.action = {
          type: AgentActionType.RESPOND,
          response: 'No LLM provider configured',
        };
        step.state = AgentState.COMPLETED;
        step.result = {
          success: true,
          output: 'No LLM provider configured',
        };
      }

      step.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.STEP_COMPLETED, context.executionId, {
        stepNumber,
        state: step.state,
        duration: step.duration,
      });

      // Yield the completed step
      yield { type: 'step', step };
    } catch (error) {
      step.state = AgentState.FAILED;
      step.error = error as Error;
      step.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.STEP_FAILED, context.executionId, {
        stepNumber,
        state: step.state,
        error: (error as Error).message,
      });

      yield { type: 'step', step };
    }
  }

  /**
   * Decide next action using LLM. Optionally streams and returns token chunks.
   */
  private async decideNextAction(
    context: AgentContext,
    opts?: { signal?: AbortSignal; streaming?: boolean }
  ): Promise<{ action: AgentAction; tokenChunks?: string[] }> {
    if (!this.llmProvider) {
      return {
        action: {
          type: AgentActionType.RESPOND,
          response: 'No LLM provider configured',
        },
      };
    }

    const prompt = this.buildPrompt(context);
    const tools = this.toolRegistry.getToolDefinitionsForLLM(context.agentId);
    const messages = [
      { role: 'system' as const, content: prompt.system },
      ...prompt.messages,
      { role: 'user' as const, content: context.input },
    ];
    const request = {
      messages,
      tools: tools.length > 0 ? tools : undefined,
    };

    const streamChat = this.llmProvider?.streamChat;
    const useStreaming = !!(opts?.streaming && streamChat);

    try {
      if (useStreaming && streamChat) {
        const tokenChunks: string[] = [];
        let content = '';
        for await (const chunk of streamChat(request)) {
          if (opts?.signal) this.throwIfAborted(opts.signal);
          if (chunk.content) {
            tokenChunks.push(chunk.content);
            content += chunk.content;
          }
        }
        return {
          action: { type: AgentActionType.RESPOND, response: content },
          tokenChunks,
        };
      }

      const response = await this.llmProvider.chat(request);

      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0];
        let toolInput: Record<string, unknown>;
        try {
          toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch (parseError) {
          throw AgentError.invalidToolInput(
            toolCall.function.name,
            'Invalid JSON in tool arguments',
            parseError as Error
          );
        }
        return {
          action: {
            type: AgentActionType.USE_TOOL,
            toolName: toolCall.function.name,
            toolInput,
            thought: response.content,
          },
        };
      }

      return {
        action: { type: AgentActionType.RESPOND, response: response.content },
      };
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw AgentError.llmError(
        'I encountered an error while processing your request.',
        error as Error
      );
    }
  }

  /**
   * Execute a tool
   */
  private async executeTool(context: AgentContext, action: AgentAction): Promise<AgentStepResult> {
    if (!action.toolName || !action.toolInput) {
      return {
        success: false,
        error: 'Tool name or input missing',
      };
    }

    const fullToolName = `${context.agentId}.${action.toolName}`;
    const tool = this.toolRegistry.getTool(fullToolName);

    if (!tool) {
      return {
        success: false,
        error: AgentError.toolNotFound(action.toolName).message,
      };
    }

    const result = await this.toolExecutor.execute(
      tool,
      action.toolInput,
      context.agentId,
      context.sessionId,
      context.userId
    );

    // Store as assistant message summarizing the tool call + result (OpenAI requires tool
    // messages to follow assistant messages with tool_calls; we avoid that format to keep
    // storage simple and ensure the LLM receives the tool result context)
    const toolSummary = `[Tool: ${action.toolName}]\nInput: ${JSON.stringify(action.toolInput)}\nOutput: ${JSON.stringify(result.output)}`;
    await this.unwrap(this.stateManager.addMessage(context.executionId, 'assistant', toolSummary));

    return {
      success: result.success,
      output: result.output,
      error: result.error?.message,
      metadata: {
        duration: result.duration,
      },
    };
  }

  /**
   * Build prompt for LLM
   */
  private buildPrompt(context: AgentContext): {
    system: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string }>;
  } {
    const basePrompt = (context.metadata?.systemPrompt as string) || 'You are a helpful AI agent.';
    const description = (context.metadata?.agentDescription as string) || '';
    const ragContext =
      context.ragContext && context.ragContext.length > 0 ? context.ragContext.join('\n\n') : '';

    let systemPrompt: string;

    if (description || ragContext) {
      systemPrompt = PromptRegistry.get<{
        systemPrompt: string;
        description: string;
        ragContext: string;
      }>(AGENT_SYSTEM_KEY)
        .render({ systemPrompt: basePrompt, description, ragContext })
        .replace(/\n\nAgent description: \n/, '\n')
        .replace(/\n\nRelevant context:\n$/, '');
    } else {
      systemPrompt = basePrompt;
    }

    const messages = context.memory.conversationHistory.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
      content: msg.content,
    }));

    return {
      system: systemPrompt,
      messages,
    };
  }

  /**
   * Resume execution after pause
   */
  async resume(executionId: string, input?: string): Promise<AgentExecutionResult> {
    const contextResult = this.stateManager.getContext(executionId);
    const context = await this.unwrap(contextResult);
    if (!context) {
      throw AgentError.executionNotFound(executionId);
    }

    if (input) {
      await this.unwrap(this.stateManager.addMessage(executionId, 'user', input));
      this.emitEvent(AgentEventType.USER_INPUT_RECEIVED, executionId, {
        response: input,
      });
    }

    await this.unwrap(this.stateManager.updateState(executionId, AgentState.THINKING));

    return this.execute(context);
  }

  /**
   * Emit event
   */
  private emitEvent(type: AgentEventType, executionId: string, data: unknown): void {
    if (this.eventEmitter) {
      this.eventEmitter(type, executionId, data);
    }
  }
}
