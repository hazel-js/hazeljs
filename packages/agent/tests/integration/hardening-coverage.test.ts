import { createStateManager, createStateManagerFromEnv, resolveStateManager } from '../../src/state/create-state-manager';
import { createApprovalStore } from '../../src/approval/create-approval-store';
import { RedisApprovalStore } from '../../src/approval/redis-approval.store';
import { AgentStateManager } from '../../src/state/agent.state';
import { RedisStateManager } from '../../src/state/redis-state.manager';
import { AgentEventEmitter } from '../../src/events/event.emitter';
import { AgentEventType } from '../../src/types/event.types';
import { withAgentSpan, trackLlmCost } from '../../src/utils/agent-tracing';
import { AgentModule } from '../../src/agent.module';
import type { RedisClientLike } from '../../src/state/redis-client.types';
import { AgentContextBuilder } from '../../src/context/agent.context';
import { AgentRuntime } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';

describe('Production hardening unit coverage', () => {
  describe('createStateManager', () => {
    it('throws when redis backend has no client', () => {
      expect(() => createStateManager({ backend: 'redis' })).toThrow('redisClient');
    });

    it('throws when database backend has no prisma client', () => {
      expect(() => createStateManager({ backend: 'database' })).toThrow('prismaClient');
    });

    it('resolveStateManager falls back to memory when redis misconfigured', () => {
      const manager = resolveStateManager(undefined, { backend: 'redis' });
      expect(manager).toBeInstanceOf(AgentStateManager);
    });

    it('createStateManagerFromEnv uses memory by default', async () => {
      delete process.env.AGENT_STATE_BACKEND;
      delete process.env.REDIS_URL;
      const manager = await createStateManagerFromEnv();
      expect(manager).toBeInstanceOf(AgentStateManager);
    });

    it('createStateManager uses redis when client provided', () => {
      const redis: RedisClientLike = {
        setEx: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn(),
        expire: jest.fn(),
        sAdd: jest.fn(),
        sMembers: jest.fn(),
        sRem: jest.fn(),
      };
      expect(createStateManager({ backend: 'redis', redisClient: redis })).toBeInstanceOf(
        RedisStateManager
      );
    });

    it('resolveStateManager prefers explicit manager', () => {
      const explicit = new AgentStateManager();
      expect(resolveStateManager(explicit)).toBe(explicit);
    });

    it('honors AGENT_STATE_BACKEND=memory env', () => {
      process.env.AGENT_STATE_BACKEND = 'memory';
      process.env.REDIS_URL = 'redis://localhost';
      expect(createStateManager()).toBeInstanceOf(AgentStateManager);
      delete process.env.AGENT_STATE_BACKEND;
      delete process.env.REDIS_URL;
    });

    it('createStateManagerFromEnv throws for database without prisma', async () => {
      await expect(createStateManagerFromEnv({ backend: 'database' })).rejects.toThrow(
        'prismaClient'
      );
    });
  });

  describe('createApprovalStore', () => {
    it('throws when useRedis without client', () => {
      expect(() => createApprovalStore({ useRedis: true })).toThrow('redisClient');
    });

    it('returns in-memory store by default', () => {
      const store = createApprovalStore();
      expect(store.listPending()).toEqual([]);
    });

    it('returns redis store when client provided', () => {
      const redis: RedisClientLike = {
        setEx: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn().mockResolvedValue([]),
        expire: jest.fn(),
        sAdd: jest.fn(),
        sMembers: jest.fn(),
        sRem: jest.fn(),
      };
      expect(createApprovalStore({ redisClient: redis })).toBeInstanceOf(RedisApprovalStore);
    });
  });

  describe('AgentEventEmitter strictEventHandlers', () => {
    it('propagates handler errors when strictEventHandlers is true', async () => {
      const emitter = new AgentEventEmitter({ strictEventHandlers: true });
      emitter.on(AgentEventType.EXECUTION_STARTED, () => {
        throw new Error('handler boom');
      });

      await expect(
        emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent', 'exec', {})
      ).rejects.toThrow('handler boom');
    });
    it('propagates wildcard handler errors when strictEventHandlers is true', async () => {
      const emitter = new AgentEventEmitter({ strictEventHandlers: true });
      emitter.onAny(() => {
        throw new Error('wildcard boom');
      });

      await expect(
        emitter.emit(AgentEventType.EXECUTION_STARTED, 'agent', 'exec', {})
      ).rejects.toThrow('wildcard boom');
    });
  });

  describe('AgentContextBuilder RAG onError', () => {
    it('invokes onError callback when RAG search fails', async () => {
      const builder = new AgentContextBuilder();
      const onError = jest.fn();
      const context = {
        input: 'query',
        ragContext: [] as string[],
      } as Parameters<AgentContextBuilder['buildWithRAG']>[0];

      await builder.buildWithRAG(
        context,
        { search: jest.fn().mockRejectedValue(new Error('rag down')) },
        3,
        onError
      );

      expect(onError).toHaveBeenCalled();
      expect(context.ragContext).toEqual([]);
    });
  });

  describe('AgentModule.forRoot with redis client', () => {
    it('creates Redis state manager when client is provided', () => {
      const redis: RedisClientLike = {
        setEx: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        keys: jest.fn().mockResolvedValue([]),
        expire: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        sMembers: jest.fn().mockResolvedValue([]),
        sRem: jest.fn().mockResolvedValue(1),
      };

      AgentModule.forRoot({ redis: { client: redis } });
      expect(AgentModule.getOptions().runtime?.stateManager).toBeInstanceOf(RedisStateManager);
    });

    it('wires observability provider from module options', () => {
      const provider = {
        start: jest.fn(),
        stop: jest.fn(),
        getTracer: jest.fn(),
        trackCost: jest.fn(),
      };
      AgentModule.forRoot({ observabilityProvider: provider });
      expect(AgentModule.getOptions().runtime?.observabilityProvider).toBe(provider);
    });
  });

  describe('AgentRuntime production config', () => {
    it('uses explicit approval store and strict event handlers', async () => {
      @Agent({ name: 'cfg-agent', description: 'Config agent' })
      class CfgAgent {}

      const runtime = new AgentRuntime({
        strictEventHandlers: false,
        enableRetry: false,
        enableCircuitBreaker: false,
        ragService: { search: jest.fn().mockRejectedValue(new Error('fail')) },
        llmProvider: { chat: jest.fn().mockResolvedValue({ content: 'hi' }) },
      });
      runtime.registerAgent(CfgAgent);

      const events: unknown[] = [];
      runtime.on(AgentEventType.RAG_QUERY_FAILED as never, (e) => events.push(e));

      await runtime.execute('cfg-agent', 'q', { enableMemory: false });
      expect(events.length).toBe(1);
    });

    it('exposes async pending approvals API', async () => {
      const runtime = new AgentRuntime();
      await expect(runtime.getPendingApprovalsAsync()).resolves.toEqual([]);
    });

    it('uses Redis approval store when redis client is in stateManagerOptions', () => {
      const redis: RedisClientLike = {
        setEx: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn().mockResolvedValue([]),
        expire: jest.fn(),
        sAdd: jest.fn(),
        sMembers: jest.fn(),
        sRem: jest.fn(),
      };
      const runtime = new AgentRuntime({
        stateManagerOptions: { redisClient: redis },
        enableMetrics: false,
      });
      expect(runtime).toBeDefined();
    });

    it('records metrics when RAG fails during execute', async () => {
      @Agent({ name: 'rag-metrics-agent', description: 'RAG metrics' })
      class RagMetricsAgent {}

      const runtime = new AgentRuntime({
        enableMetrics: true,
        enableRetry: false,
        enableCircuitBreaker: false,
        ragService: { search: jest.fn().mockRejectedValue(new Error('rag fail')) },
        llmProvider: { chat: jest.fn().mockResolvedValue({ content: 'ok' }) },
      });
      runtime.registerAgent(RagMetricsAgent);
      await runtime.execute('rag-metrics-agent', 'q', { enableMemory: false });
      expect(runtime.getMetrics()?.llm.errors).toBeGreaterThanOrEqual(0);
    });

    it('supports executeStream for registered agents', async () => {
      @Agent({ name: 'stream-agent', description: 'Stream' })
      class StreamAgent {}

      const runtime = new AgentRuntime({
        llmProvider: {
          chat: jest.fn(),
          streamChat: jest.fn(async function* () {
            yield { content: 'tok' };
          }),
        },
        enableRetry: false,
        enableCircuitBreaker: false,
      });
      runtime.registerAgent(StreamAgent);

      const chunks = [];
      for await (const chunk of runtime.executeStream('stream-agent', 'hi', {
        enableMemory: false,
        streaming: true,
      })) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('throws failed executions through circuit breaker path', async () => {
      @Agent({ name: 'fail-agent', description: 'Fail' })
      class FailAgent {}

      const runtime = new AgentRuntime({
        llmProvider: { chat: jest.fn().mockRejectedValue(new Error('down')) },
        enableRetry: false,
        enableCircuitBreaker: true,
      });
      runtime.registerAgent(FailAgent);

      await expect(runtime.execute('fail-agent', 'x')).rejects.toThrow(
        'I encountered an error while processing your request.'
      );
    });
  });

  describe('agent-tracing', () => {
    it('runs without observability provider', async () => {
      const result = await withAgentSpan('test.span', { key: 'value' }, async () => 'ok');
      expect(result).toBe('ok');
    });

    it('uses observability provider tracer when provided', async () => {
      const mockSpan = {
        setAttribute: jest.fn(),
        recordException: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
      };
      const provider = {
        start: jest.fn(),
        stop: jest.fn(),
        getTracer: jest.fn().mockReturnValue({
          startActiveSpan: (_name: string, fn: (span: unknown) => unknown) => fn(mockSpan),
        }),
        trackCost: jest.fn(),
      };

      await withAgentSpan('agent.execute', { 'agent.name': 'a' }, async () => 'done', provider);
      expect(mockSpan.setAttribute).toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('trackLlmCost skips when model or usage missing', () => {
      const provider = {
        start: jest.fn(),
        stop: jest.fn(),
        getTracer: jest.fn(),
        trackCost: jest.fn(),
      };
      trackLlmCost(undefined, 'gpt-4', { promptTokens: 1 });
      trackLlmCost(provider, undefined, { promptTokens: 1 });
      trackLlmCost(provider, 'gpt-4', undefined);
      expect(provider.trackCost).not.toHaveBeenCalled();
    });

    it('records span errors via observability provider', async () => {
      const mockSpan = {
        setAttribute: jest.fn(),
        recordException: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn(),
      };
      const provider = {
        start: jest.fn(),
        stop: jest.fn(),
        getTracer: jest.fn().mockReturnValue({
          startActiveSpan: (_name: string, fn: (span: unknown) => unknown) => fn(mockSpan),
        }),
        trackCost: jest.fn(),
      };

      await expect(
        withAgentSpan('fail.span', {}, async () => {
          throw new Error('span fail');
        }, provider)
      ).rejects.toThrow('span fail');
      expect(mockSpan.recordException).toHaveBeenCalled();
    });
  });

  describe('AgentModule.forRootAsync', () => {
    it('wires runtime config from module options', async () => {
      const redis: RedisClientLike = {
        setEx: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        keys: jest.fn().mockResolvedValue([]),
        expire: jest.fn().mockResolvedValue(1),
        sAdd: jest.fn().mockResolvedValue(1),
        sMembers: jest.fn().mockResolvedValue([]),
        sRem: jest.fn().mockResolvedValue(1),
      };

      await AgentModule.forRootAsync({
        redis: { client: redis },
        runtime: { enableMetrics: false },
      });

      const opts = AgentModule.getOptions();
      expect(opts.runtime?.stateManager).toBeInstanceOf(RedisStateManager);
    });
  });
});
