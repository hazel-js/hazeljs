/**
 * Streaming-specific methods for AgentExecutor
 * This file contains the executeStepStream method for real-time token streaming
 */

import { AgentContext, AgentStep, AgentState, AgentActionType } from '../types/agent.types';
import { AgentStreamChunk } from '../types/agent.types';
import { randomUUID } from 'crypto';
import { AgentEventType } from '../types/event.types';

/**
 * Execute a single step with real-time token streaming.
 * Yields tokens as they arrive from the LLM instead of buffering them.
 * Note: This function is bound to AgentExecutor and accesses its private members
 */
export async function* executeStepStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this: any,
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

      // Stream tokens in real-time as they arrive
      for await (const chunk of streamChat(request)) {
        if (signal) this.throwIfAborted(signal);
        if (chunk.content) {
          content += chunk.content;
          // Yield each token immediately
          yield { type: 'token', content: chunk.content };
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
    } else {
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
