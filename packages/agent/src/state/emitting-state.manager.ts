/**
 * Wraps an IAgentStateManager so every updateState emits STATE_CHANGED
 * with previous/new state — single transition path for timeline + onState.
 */

import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { AgentEventType } from '../types/event.types';
import { IAgentStateManager } from './agent-state.interface';

export type StateChangeEmitter = (
  type: AgentEventType,
  agentId: string,
  executionId: string,
  data: unknown
) => void | Promise<void>;

export class EmittingStateManager implements IAgentStateManager {
  constructor(
    private readonly inner: IAgentStateManager,
    private readonly emit: StateChangeEmitter
  ) {}

  createContext(
    agentId: string,
    sessionId: string,
    input: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentContext> | AgentContext {
    return this.inner.createContext(agentId, sessionId, input, userId, metadata);
  }

  getContext(executionId: string): Promise<AgentContext | undefined> | AgentContext | undefined {
    return this.inner.getContext(executionId);
  }

  async updateState(executionId: string, newState: AgentState): Promise<void> {
    const ctxResult = this.inner.getContext(executionId);
    const context = ctxResult instanceof Promise ? await ctxResult : ctxResult;
    const previousState = context?.state ?? AgentState.IDLE;
    const agentId = context?.agentId ?? '';

    const update = this.inner.updateState(executionId, newState);
    if (update instanceof Promise) await update;

    if (previousState !== newState) {
      await this.emit(AgentEventType.STATE_CHANGED, agentId, executionId, {
        previousState,
        newState,
      });
    }
  }

  addStep(executionId: string, step: AgentStep): Promise<void> | void {
    return this.inner.addStep(executionId, step);
  }

  updateLastStep(executionId: string, updates: Partial<AgentStep>): Promise<void> | void {
    return this.inner.updateLastStep(executionId, updates);
  }

  addMessage(
    executionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
  ): Promise<void> | void {
    return this.inner.addMessage(executionId, role, content);
  }

  setWorkingMemory(executionId: string, key: string, value: unknown): Promise<void> | void {
    return this.inner.setWorkingMemory(executionId, key, value);
  }

  getWorkingMemory(executionId: string, key: string): Promise<unknown> | unknown {
    return this.inner.getWorkingMemory(executionId, key);
  }

  addRAGContext(executionId: string, contexts: string[]): Promise<void> | void {
    return this.inner.addRAGContext(executionId, contexts);
  }

  canContinue(executionId: string, maxSteps: number): Promise<boolean> | boolean {
    return this.inner.canContinue(executionId, maxSteps);
  }

  deleteContext(executionId: string): Promise<void> | void {
    return this.inner.deleteContext(executionId);
  }

  clear(): Promise<void> | void {
    return this.inner.clear();
  }

  getSessionContexts(sessionId: string): Promise<AgentContext[]> | AgentContext[] {
    return this.inner.getSessionContexts(sessionId);
  }

  putContext(context: AgentContext): Promise<void> | void {
    if (typeof this.inner.putContext === 'function') {
      return this.inner.putContext(context);
    }
    throw new Error('State manager does not support putContext (required for durable HITL resume)');
  }
}
