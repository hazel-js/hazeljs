/**
 * Database State Manager
 * Prisma-backed persistence for agent execution state
 * Provides durable, queryable state management with full audit trail
 */

import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
import { randomUUID } from 'crypto';

// Type for Prisma client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

// Database record types
interface DatabaseStep {
  id: string;
  agentId: string;
  executionId: string;
  stepNumber: number;
  state: string;
  action?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
  timestamp: string | Date;
  duration?: number;
}

interface DatabaseMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string | Date;
}

interface DatabaseEntity {
  name: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface DatabaseRecord {
  executionId: string;
  agentId: string;
  sessionId: string;
  userId: string | null;
  input: string;
  state: string;
  steps: DatabaseStep[];
  conversationHistory: DatabaseMessage[];
  workingMemory: Record<string, unknown>;
  facts: string[];
  entities: DatabaseEntity[];
  ragContext: string[] | null;
  metadata: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatabaseStateManagerConfig {
  /**
   * Prisma client instance
   */
  client: PrismaClient;
  /**
   * Whether to enable soft deletes (keep deleted contexts for audit)
   * @default true
   */
  softDelete?: boolean;
  /**
   * Whether to automatically archive completed contexts
   * @default false
   */
  autoArchive?: boolean;
  /**
   * Archive threshold in days (contexts older than this are archived)
   * @default 30
   */
  archiveThresholdDays?: number;
}

/**
 * Database-backed state manager for agent execution state
 * Provides durable persistence with full query capabilities and audit trail
 */
export class DatabaseStateManager implements IAgentStateManager {
  private client: PrismaClient;
  private softDelete: boolean;
  private autoArchive: boolean;
  private archiveThresholdDays: number;

  constructor(config: DatabaseStateManagerConfig) {
    if (!config.client) {
      throw new Error('Prisma client is required');
    }
    this.client = config.client;
    this.softDelete = config.softDelete !== false;
    this.autoArchive = config.autoArchive || false;
    this.archiveThresholdDays = config.archiveThresholdDays || 30;
  }

  /**
   * Convert database record to AgentContext
   */
  private toContext(record: DatabaseRecord): AgentContext {
    return {
      executionId: record.executionId,
      agentId: record.agentId,
      sessionId: record.sessionId,
      userId: record.userId || undefined,
      input: record.input,
      state: record.state as AgentState,
      steps: (record.steps || []).map(
        (step: DatabaseStep): AgentStep => ({
          id: step.id,
          agentId: step.agentId,
          executionId: step.executionId,
          stepNumber: step.stepNumber,
          state: step.state as AgentState,
          action: step.action as AgentStep['action'],
          result: step.result as AgentStep['result'],
          error: step.error as AgentStep['error'],
          timestamp: new Date(step.timestamp),
          duration: step.duration,
        })
      ),
      memory: {
        conversationHistory: (record.conversationHistory || []).map((msg: DatabaseMessage) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        })),
        workingMemory: record.workingMemory || {},
        facts: record.facts || [],
        entities: record.entities || [],
      },
      ragContext: record.ragContext || undefined,
      metadata: record.metadata || {},
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  /**
   * Convert AgentContext to database record
   */
  private toRecord(context: AgentContext): Record<string, unknown> {
    return {
      executionId: context.executionId,
      agentId: context.agentId,
      sessionId: context.sessionId,
      userId: context.userId || null,
      input: context.input,
      state: context.state,
      steps: context.steps,
      conversationHistory: context.memory.conversationHistory,
      workingMemory: context.memory.workingMemory,
      facts: context.memory.facts,
      entities: context.memory.entities,
      ragContext: context.ragContext || null,
      metadata: context.metadata,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
    };
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

    const record = this.toRecord(context);

    await this.client.agentContext.create({
      data: record,
    });

    return context;
  }

  async getContext(executionId: string): Promise<AgentContext | undefined> {
    const record = await this.client.agentContext.findUnique({
      where: { executionId },
    });

    if (!record) {
      return undefined;
    }

    return this.toContext(record);
  }

  async updateState(executionId: string, newState: AgentState): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.state = newState;
    context.updatedAt = new Date();

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        state: newState,
        updatedAt: context.updatedAt,
      },
    });
  }

  async addStep(executionId: string, step: AgentStep): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.steps.push(step);
    context.updatedAt = new Date();

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        steps: context.steps,
        updatedAt: context.updatedAt,
      },
    });
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

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        steps: context.steps,
        updatedAt: context.updatedAt,
      },
    });
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

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        conversationHistory: context.memory.conversationHistory,
        updatedAt: context.updatedAt,
      },
    });
  }

  async setWorkingMemory(executionId: string, key: string, value: unknown): Promise<void> {
    const context = await this.getContext(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.memory.workingMemory[key] = value;
    context.updatedAt = new Date();

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        workingMemory: context.memory.workingMemory,
        updatedAt: context.updatedAt,
      },
    });
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

    await this.client.agentContext.update({
      where: { executionId },
      data: {
        ragContext: contexts,
        updatedAt: context.updatedAt,
      },
    });
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
    if (this.softDelete) {
      await this.client.agentContext.update({
        where: { executionId },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      await this.client.agentContext.delete({
        where: { executionId },
      });
    }
  }

  async clear(): Promise<void> {
    if (this.softDelete) {
      await this.client.agentContext.updateMany({
        where: { deletedAt: null },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      await this.client.agentContext.deleteMany({});
    }
  }

  async getSessionContexts(sessionId: string): Promise<AgentContext[]> {
    const records = await this.client.agentContext.findMany({
      where: {
        sessionId,
        deletedAt: this.softDelete ? null : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records.map((record: DatabaseRecord) => this.toContext(record));
  }
}
