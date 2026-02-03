/**
 * Redis State Manager
 * Redis-backed persistence for agent execution state
 * Provides fast, distributed state management with TTL support
 */

import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
import { randomUUID } from 'crypto';

// Type for Redis client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

export interface RedisStateManagerConfig {
  /**
   * Redis client instance
   */
  client: RedisClient;
  /**
   * Key prefix for all agent state keys
   * @default "agent:state:"
   */
  keyPrefix?: string;
  /**
   * Default TTL for execution contexts in seconds
   * @default 3600 (1 hour)
   */
  defaultTTL?: number;
  /**
   * TTL for completed contexts in seconds
   * @default 86400 (24 hours)
   */
  completedTTL?: number;
  /**
   * TTL for failed contexts in seconds
   * @default 604800 (7 days)
   */
  failedTTL?: number;
}

/**
 * Redis-backed state manager for agent execution state
 * Provides fast, distributed state management with automatic expiration
 */
export class RedisStateManager implements IAgentStateManager {
  private client: RedisClient;
  private keyPrefix: string;
  private defaultTTL: number;
  private completedTTL: number;
  private failedTTL: number;

  constructor(config: RedisStateManagerConfig) {
    if (!config.client) {
      throw new Error('Redis client is required');
    }
    this.client = config.client;
    this.keyPrefix = config.keyPrefix || 'agent:state:';
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour
    this.completedTTL = config.completedTTL || 86400; // 24 hours
    this.failedTTL = config.failedTTL || 604800; // 7 days
  }

  /**
   * Get the Redis key for an execution context
   */
  private getKey(executionId: string): string {
    return `${this.keyPrefix}${executionId}`;
  }

  /**
   * Get the Redis key for session contexts
   */
  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}session:${sessionId}`;
  }

  /**
   * Serialize context to JSON
   */
  private serialize(context: AgentContext): string {
    return JSON.stringify(context, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  }

  /**
   * Deserialize context from JSON
   */
  private deserialize(data: string): AgentContext {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      steps: parsed.steps.map((step: AgentStep) => ({
        ...step,
        timestamp: new Date(step.timestamp),
      })),
      memory: {
        ...parsed.memory,
        conversationHistory: parsed.memory.conversationHistory.map(
          (msg: { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })
        ),
      },
    };
  }

  /**
   * Get TTL based on state
   */
  private getTTL(state: AgentState): number {
    if (state === AgentState.COMPLETED) {
      return this.completedTTL;
    }
    if (state === AgentState.FAILED) {
      return this.failedTTL;
    }
    return this.defaultTTL;
  }

  async createContext(
    agentId: string,
    sessionId: string,
    input: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentContext> {
    const executionId = randomUUID();
    const now = new Date();

    const context: AgentContext = {
      executionId,
      agentId,
      sessionId,
      userId,
      input,
      state: AgentState.IDLE,
      steps: [],
      memory: {
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
      },
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const key = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    // Store context
    await this.client.setEx(key, ttl, serialized);

    // Add to session index
    await this.client.sAdd(this.getSessionKey(sessionId), executionId);
    await this.client.expire(this.getSessionKey(sessionId), ttl);

    return context;
  }

  async getContext(executionId: string): Promise<AgentContext | undefined> {
    const key = this.getKey(executionId);
    const data = await this.client.get(key);

    if (!data) {
      return undefined;
    }

    return this.deserialize(data);
  }

  async updateState(executionId: string, newState: AgentState): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.state = newState;
    context.updatedAt = new Date();

    const key = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(newState);

    await this.client.setEx(key, ttl, serialized);
  }

  async addStep(executionId: string, step: AgentStep): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.steps.push(step);
    context.updatedAt = new Date();

    const key = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    await this.client.setEx(key, ttl, serialized);
  }

  async updateLastStep(executionId: string, updates: Partial<AgentStep>): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    if (context.steps.length === 0) {
      throw new Error('No steps to update');
    }

    const lastStep = context.steps[context.steps.length - 1];
    Object.assign(lastStep, updates);
    context.updatedAt = new Date();

    const key = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    await this.client.setEx(key, ttl, serialized);
  }

  async addMessage(
    executionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
  ): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.memory.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
    });
    context.updatedAt = new Date();

    const key = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    await this.client.setEx(key, ttl, serialized);
  }

  async setWorkingMemory(executionId: string, key: string, value: unknown): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.memory.workingMemory[key] = value;
    context.updatedAt = new Date();

    const redisKey = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    await this.client.setEx(redisKey, ttl, serialized);
  }

  async getWorkingMemory(executionId: string, key: string): Promise<unknown> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    return context.memory.workingMemory[key];
  }

  async addRAGContext(executionId: string, contexts: string[]): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.ragContext = contexts;
    context.updatedAt = new Date();

    const redisKey = this.getKey(executionId);
    const serialized = this.serialize(context);
    const ttl = this.getTTL(context.state);

    await this.client.setEx(redisKey, ttl, serialized);
  }

  async canContinue(executionId: string, maxSteps: number): Promise<boolean> {
    const context = await this.getContext(executionId);
    if (!context) {
      return false;
    }

    if (context.state === AgentState.COMPLETED || context.state === AgentState.FAILED) {
      return false;
    }

    if (context.steps.length >= maxSteps) {
      return false;
    }

    return true;
  }

  async deleteContext(executionId: string): Promise<void> {
    const context = await this.getContext(executionId);
    if (context) {
      // Remove from session index
      await this.client.sRem(this.getSessionKey(context.sessionId), executionId);
    }

    const key = this.getKey(executionId);
    await this.client.del(key);
  }

  async clear(): Promise<void> {
    // Get all keys with prefix
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async getSessionContexts(sessionId: string): Promise<AgentContext[]> {
    const sessionKey = this.getSessionKey(sessionId);
    const executionIds = await this.client.sMembers(sessionKey);

    const contexts: AgentContext[] = [];
    for (const executionId of executionIds) {
      const context = await this.getContext(executionId);
      if (context) {
        contexts.push(context);
      }
    }

    return contexts;
  }
}
