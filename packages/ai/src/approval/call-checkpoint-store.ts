import type { AICompletionRequest, AIMessage, AIProvider, AIToolCall } from '../ai-enhanced.types';
import type { AICallBudget, AIModelPricing, AIRetryDefaults } from '../models/model-registry.types';

/** Serializable subset of CompleteCallConfig needed to resume a tool loop. */
export interface CheckpointCallConfig {
  provider?: AIProvider;
  modelName?: string;
  userId?: string;
  label?: string;
  tools?: string[];
  approve?: string[];
  maxSteps?: number;
  budget?: AICallBudget;
  caller?: Record<string, unknown>;
}

export interface CallCheckpoint {
  id: string;
  createdAt: number;
  messages: AIMessage[];
  /** Original request fields (model, temperature, etc.) without relying on live state. */
  request: Pick<
    AICompletionRequest,
    'model' | 'temperature' | 'maxTokens' | 'topP' | 'responseFormat'
  >;
  config: CheckpointCallConfig;
  resolved: {
    name?: string;
    provider: AIProvider;
    modelId: string;
    fallback: string[];
    pricing?: AIModelPricing;
    timeoutMs?: number;
    retry?: AIRetryDefaults;
  };
  running: { promptTokens: number; completionTokens: number; totalTokens: number };
  runningCost: number;
  pendingToolCall: AIToolCall;
  pendingInput: unknown;
  approvalId: string;
  idempotencyKey: string;
}

export interface CallCheckpointStore {
  save(checkpoint: CallCheckpoint): Promise<void>;
  get(id: string): Promise<CallCheckpoint | undefined>;
  delete(id: string): Promise<void>;
}

export class InMemoryCallCheckpointStore implements CallCheckpointStore {
  private readonly map = new Map<string, CallCheckpoint>();

  async save(checkpoint: CallCheckpoint): Promise<void> {
    this.map.set(checkpoint.id, structuredClone(checkpoint));
  }

  async get(id: string): Promise<CallCheckpoint | undefined> {
    const v = this.map.get(id);
    return v ? structuredClone(v) : undefined;
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

/**
 * Duck-typed HumanTask-backed store. Apps wire Agent OS HumanTaskService methods.
 */
export interface HumanTaskCheckpointAdapter {
  create(task: { id: string; type: string; payload: CallCheckpoint }): Promise<void>;
  get(id: string): Promise<{ payload: CallCheckpoint } | undefined>;
  complete?(id: string): Promise<void>;
}

export function createHumanTaskCallCheckpointStore(
  humanTasks: HumanTaskCheckpointAdapter
): CallCheckpointStore {
  return {
    async save(checkpoint: CallCheckpoint): Promise<void> {
      await humanTasks.create({
        id: checkpoint.id,
        type: 'ai.call.approval',
        payload: checkpoint,
      });
    },
    async get(id: string): Promise<CallCheckpoint | undefined> {
      const task = await humanTasks.get(id);
      return task?.payload;
    },
    async delete(id: string): Promise<void> {
      await humanTasks.complete?.(id);
    },
  };
}
