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
} from '../types/agent.types';
import { IAgentStateManager } from '../state/agent-state.interface';
import { AgentContextBuilder } from '../context/agent.context';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry } from '../registry/tool.registry';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';

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

  /**
   * Execute agent with controlled loop
   */
  async execute(context: AgentContext, maxSteps: number = 10): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
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
        stepNumber++;

        const step = await this.executeStep(context, stepNumber);
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
        throw new Error(`Maximum steps (${maxSteps}) exceeded`);
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
   * Execute a single step
   */
  private async executeStep(context: AgentContext, stepNumber: number): Promise<AgentStep> {
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
      const action = await this.decideNextAction(context);
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

      return step;
    } catch (error) {
      step.state = AgentState.FAILED;
      step.error = error as Error;
      step.duration = Date.now() - startTime;

      this.emitEvent(AgentEventType.STEP_FAILED, context.executionId, {
        stepNumber,
        state: step.state,
        error: (error as Error).message,
      });

      return step;
    }
  }

  /**
   * Decide next action using LLM
   */
  private async decideNextAction(context: AgentContext): Promise<AgentAction> {
    if (!this.llmProvider) {
      return {
        type: AgentActionType.RESPOND,
        response: 'No LLM provider configured',
      };
    }

    const prompt = this.buildPrompt(context);
    const tools = this.toolRegistry.getToolDefinitionsForLLM(context.agentId);

    try {
      const response = await this.llmProvider.chat({
        messages: [
          { role: 'system', content: prompt.system },
          ...prompt.messages,
          { role: 'user', content: context.input },
        ],
        tools: tools.length > 0 ? tools : undefined,
      });

      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0];
        return {
          type: AgentActionType.USE_TOOL,
          toolName: toolCall.function.name,
          toolInput: JSON.parse(toolCall.function.arguments),
          thought: response.content,
        };
      }

      return {
        type: AgentActionType.RESPOND,
        response: response.content,
      };
    } catch {
      return {
        type: AgentActionType.RESPOND,
        response: 'I encountered an error while processing your request.',
      };
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
        error: `Tool ${action.toolName} not found`,
      };
    }

    const result = await this.toolExecutor.execute(
      tool,
      action.toolInput,
      context.agentId,
      context.sessionId,
      context.userId
    );

    await this.unwrap(
      this.stateManager.addMessage(
        context.executionId,
        'tool',
        JSON.stringify({
          tool: action.toolName,
          input: action.toolInput,
          output: result.output,
        })
      )
    );

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
    let systemPrompt = (context.metadata?.systemPrompt as string) || 'You are a helpful AI agent.';

    if (context.metadata?.agentDescription) {
      systemPrompt += `\n\nAgent description: ${context.metadata.agentDescription}`;
    }

    if (context.ragContext && context.ragContext.length > 0) {
      systemPrompt += '\n\nRelevant context:\n' + context.ragContext.join('\n\n');
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
      throw new Error(`Execution context ${executionId} not found`);
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
