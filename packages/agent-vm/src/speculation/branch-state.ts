/**
 * Copy-on-write branch state manager — branches never mutate parent until commit.
 */

import { randomUUID } from 'crypto';
import { AgentState, type AgentContext, type AgentStep } from '@hazeljs/agent';
import type { IAgentStateManager } from '@hazeljs/agent';
import { AgentError } from '@hazeljs/agent';

function cloneContext(context: AgentContext): AgentContext {
  return {
    ...context,
    steps: context.steps.map((s) => ({ ...s, timestamp: new Date(s.timestamp) })),
    memory: {
      conversationHistory: context.memory.conversationHistory.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      workingMemory: { ...context.memory.workingMemory },
      facts: [...context.memory.facts],
      entities: [...context.memory.entities],
    },
    ragContext: context.ragContext ? [...context.ragContext] : undefined,
    metadata: { ...context.metadata },
    createdAt: new Date(context.createdAt),
    updatedAt: new Date(context.updatedAt),
  };
}

export class BranchStateManager implements IAgentStateManager {
  private readonly branchContexts = new Map<string, AgentContext>();
  private readonly branchToParent = new Map<string, string>();

  constructor(private readonly parent: IAgentStateManager) {}

  private unwrap<T>(value: T | Promise<T>): T {
    if (value instanceof Promise) {
      throw new Error('BranchStateManager requires a synchronous parent IAgentStateManager');
    }
    return value;
  }

  /** Fork a new branch from an existing execution context. */
  fork(parentExecutionId: string, branchId?: string): AgentContext {
    const parentCtx = this.unwrap(this.parent.getContext(parentExecutionId));
    if (!parentCtx) {
      throw AgentError.executionNotFound(parentExecutionId);
    }

    const id = branchId ?? randomUUID();
    const branchCtx = cloneContext(parentCtx);
    branchCtx.executionId = id;
    branchCtx.metadata = {
      ...branchCtx.metadata,
      branchParentId: parentExecutionId,
      branchId: id,
    };
    branchCtx.updatedAt = new Date();

    this.branchContexts.set(id, branchCtx);
    this.branchToParent.set(id, parentExecutionId);
    return branchCtx;
  }

  /** Merge winning branch state back into parent execution. */
  commit(branchId: string): AgentContext {
    const branchCtx = this.branchContexts.get(branchId);
    const parentId = this.branchToParent.get(branchId);
    if (!branchCtx || !parentId) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    const parentCtx = this.unwrap(this.parent.getContext(parentId));
    if (!parentCtx) {
      throw AgentError.executionNotFound(parentId);
    }

    parentCtx.state = branchCtx.state;
    parentCtx.steps = [...branchCtx.steps];
    parentCtx.memory = {
      conversationHistory: [...branchCtx.memory.conversationHistory],
      workingMemory: { ...branchCtx.memory.workingMemory },
      facts: [...branchCtx.memory.facts],
      entities: [...branchCtx.memory.entities],
    };
    parentCtx.ragContext = branchCtx.ragContext ? [...branchCtx.ragContext] : undefined;
    parentCtx.metadata = {
      ...parentCtx.metadata,
      ...branchCtx.metadata,
      committedBranchId: branchId,
    };
    parentCtx.updatedAt = new Date();

    if (this.parent.putContext) {
      this.parent.putContext(parentCtx);
    }

    this.discard(branchId);
    return parentCtx;
  }

  /** Drop branch state without merging. */
  discard(branchId: string): void {
    this.branchContexts.delete(branchId);
    this.branchToParent.delete(branchId);
  }

  createContext(
    agentId: string,
    sessionId: string,
    input: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AgentContext {
    return this.unwrap(this.parent.createContext(agentId, sessionId, input, userId, metadata));
  }

  getContext(executionId: string): AgentContext | undefined {
    const branch = this.branchContexts.get(executionId);
    if (branch) return branch;
    return this.unwrap(this.parent.getContext(executionId));
  }

  updateState(executionId: string, newState: AgentState): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      ctx.state = newState;
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.updateState(executionId, newState);
  }

  addStep(executionId: string, step: AgentStep): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      ctx.steps.push(step);
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.addStep(executionId, step);
  }

  updateLastStep(executionId: string, updates: Partial<AgentStep>): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      if (ctx.steps.length === 0) throw new Error('No steps to update');
      Object.assign(ctx.steps[ctx.steps.length - 1], updates);
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.updateLastStep(executionId, updates);
  }

  addMessage(
    executionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
  ): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      ctx.memory.conversationHistory.push({ role, content, timestamp: new Date() });
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.addMessage(executionId, role, content);
  }

  setWorkingMemory(executionId: string, key: string, value: unknown): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      ctx.memory.workingMemory[key] = value;
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.setWorkingMemory(executionId, key, value);
  }

  getWorkingMemory(executionId: string, key: string): unknown {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      return ctx.memory.workingMemory[key];
    }
    return this.parent.getWorkingMemory(executionId, key);
  }

  addRAGContext(executionId: string, contexts: string[]): void {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      ctx.ragContext = contexts;
      ctx.updatedAt = new Date();
      return;
    }
    this.parent.addRAGContext(executionId, contexts);
  }

  canContinue(executionId: string, maxSteps: number): boolean {
    const ctx = this.branchContexts.get(executionId);
    if (ctx) {
      if (ctx.state === AgentState.COMPLETED || ctx.state === AgentState.FAILED) return false;
      return ctx.steps.length < maxSteps;
    }
    return this.unwrap(this.parent.canContinue(executionId, maxSteps));
  }

  deleteContext(executionId: string): void {
    if (this.branchContexts.has(executionId)) {
      this.discard(executionId);
      return;
    }
    this.parent.deleteContext(executionId);
  }

  clear(): void {
    this.branchContexts.clear();
    this.branchToParent.clear();
    this.parent.clear();
  }

  putContext(context: AgentContext): void {
    if (this.branchContexts.has(context.executionId)) {
      this.branchContexts.set(context.executionId, cloneContext(context));
      return;
    }
    this.parent.putContext?.(context);
  }

  getSessionContexts(sessionId: string): AgentContext[] {
    const parentSessions = this.unwrap(this.parent.getSessionContexts(sessionId));
    const branchSessions = Array.from(this.branchContexts.values()).filter(
      (c) => c.sessionId === sessionId
    );
    return [...parentSessions, ...branchSessions];
  }
}
