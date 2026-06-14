import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { RedisStateManager } from '../../src/state/redis-state.manager';
import { createStateManager, createStateManagerFromEnv } from '../../src/state/create-state-manager';
import { RedisApprovalStore } from '../../src/approval/redis-approval.store';
import { ToolExecutor } from '../../src/executor/tool.executor';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { AgentState } from '../../src/types/agent.types';
import { CircuitBreakerError } from '@hazeljs/resilience';
import type { RedisClientLike } from '../../src/state/redis-client.types';
import type { ToolMetadata } from '../../src/types/tool.types';

function createMockRedisClient(): RedisClientLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    setEx: jest.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    expire: jest.fn(async () => 1),
    sAdd: jest.fn(async () => 1),
    sMembers: jest.fn(async () => []),
    sRem: jest.fn(async () => 1),
  };
}

describe('Production hardening integration', () => {
  describe('Redis state manager', () => {
    it('persists execution context through RedisStateManager', async () => {
      const redis = createMockRedisClient();
      const stateManager = new RedisStateManager({ client: redis });

      const context = await stateManager.createContext('agent-1', 'session-1', 'hello');
      expect(context.executionId).toBeDefined();

      const loaded = await stateManager.getContext(context.executionId);
      expect(loaded?.input).toBe('hello');
      expect(loaded?.agentId).toBe('agent-1');
    });
  });

  describe('createStateManagerFromEnv', () => {
    it('uses memory when no Redis URL is set', async () => {
      const prev = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      delete process.env.AGENT_STATE_BACKEND;

      const manager = await createStateManagerFromEnv();
      const ctx = await manager.createContext('a', 's', 'input');
      expect(ctx.input).toBe('input');

      if (prev) process.env.REDIS_URL = prev;
    });

    it('creates Redis manager when client is provided', () => {
      const redis = createMockRedisClient();
      const manager = createStateManager({ backend: 'redis', redisClient: redis });
      expect(manager).toBeInstanceOf(RedisStateManager);
    });
  });

  describe('approval store', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('completes tool execution after approval via RedisApprovalStore', async () => {
      const redis = createMockRedisClient();
      const approvalStore = new RedisApprovalStore({ client: redis });
      const executor = new ToolExecutor({ approvalStore });

      const tool: ToolMetadata = {
        name: 'payInvoice',
        description: 'Pay invoice',
        parameters: [],
        requiresApproval: true,
        method: jest.fn().mockResolvedValue({ paid: true }),
        target: {},
        propertyKey: 'payInvoice',
        agentClass: class {},
      };

      const executePromise = executor.execute(tool, { id: '1' }, 'agent-1', 'session-1');
      await Promise.resolve();

      const pending = await executor.getPendingApprovalsAsync();
      expect(pending).toHaveLength(1);

      executor.approveExecution(pending[0].requestId, 'admin');
      jest.advanceTimersByTime(500);
      await jest.runAllTimersAsync();

      const result = await executePromise;
      expect(result.success).toBe(true);
      expect(tool.method).toHaveBeenCalled();
    });
  });

  describe('circuit breaker through runtime', () => {
    it('opens circuit after repeated LLM failures and fails fast', async () => {
      @Agent({ name: 'cb-agent', description: 'Circuit breaker agent' })
      class CbAgent {}

      const chat = jest.fn().mockRejectedValue(new Error('LLM unavailable'));
      const runtime = new AgentRuntime({
        llmProvider: { chat },
        enableCircuitBreaker: true,
        enableRetry: false,
      });
      runtime.registerAgent(CbAgent);

      for (let i = 0; i < 5; i++) {
        try {
          await runtime.execute('cb-agent', 'input');
        } catch {
          // expected
        }
      }

      expect(runtime.getCircuitBreakerStatus()?.state).toBe('OPEN');

      await expect(runtime.execute('cb-agent', 'input')).rejects.toThrow(CircuitBreakerError);
    });
  });

  describe('RAG failure handling', () => {
    it('emits RAG_QUERY_FAILED and continues with empty context', async () => {
      @Agent({ name: 'rag-agent', description: 'RAG agent' })
      class RagAgent {}

      const ragService = {
        search: jest.fn().mockRejectedValue(new Error('vector store down')),
      };

      const runtime = new AgentRuntime({
        llmProvider: {
          chat: jest.fn().mockResolvedValue({ content: 'ok' }),
        },
        ragService,
        enableRetry: false,
        enableCircuitBreaker: false,
      });
      runtime.registerAgent(RagAgent);

      const ragErrors: unknown[] = [];
      runtime.on('agent.rag.failed' as never, (event) => ragErrors.push(event));

      const result = await runtime.execute('rag-agent', 'question');
      expect(result.state).toBe(AgentState.COMPLETED);
      expect(ragErrors.length).toBe(1);
    });
  });
});
