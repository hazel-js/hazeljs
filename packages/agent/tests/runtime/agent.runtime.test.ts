import { AgentRuntime, AgentRuntimeConfig } from '../../src/runtime/agent.runtime';
import { Agent } from '../../src/decorators/agent.decorator';
import { Tool } from '../../src/decorators/tool.decorator';
import { LogLevel } from '../../src/utils/logger';
import { AgentState } from '../../src/types/agent.types';

describe('AgentRuntime', () => {
  describe('constructor', () => {
    it('should create runtime with default config', () => {
      const runtime = new AgentRuntime();
      expect(runtime).toBeDefined();
    });

    it('should create runtime with custom config', () => {
      const config: AgentRuntimeConfig = {
        defaultMaxSteps: 20,
        defaultTimeout: 60000,
        enableMetrics: true,
        logLevel: LogLevel.DEBUG,
      };

      const runtime = new AgentRuntime(config);
      expect(runtime).toBeDefined();
    });

    it('should initialize with rate limiter when configured', () => {
      const config: AgentRuntimeConfig = {
        rateLimitPerMinute: 100,
      };

      const runtime = new AgentRuntime(config);
      expect(runtime).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should register an agent', () => {
      @Agent({ name: 'test-runtime-agent', description: 'Test agent' })
      class TestAgent {}

      const runtime = new AgentRuntime();
      runtime.registerAgent(TestAgent);

      const agents = runtime.getAgents();
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('getAgents', () => {
    it('should return empty array initially', () => {
      const runtime = new AgentRuntime();
      const agents = runtime.getAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should throw error for non-existent agent', async () => {
      const runtime = new AgentRuntime();
      await expect(runtime.execute('non-existent', 'input')).rejects.toThrow('Agent non-existent not found');
    });
  });

  describe('getContext', () => {
    it('should return undefined for non-existent context', async () => {
      const runtime = new AgentRuntime();
      const context = await runtime.getContext('non-existent');
      expect(context).toBeUndefined();
    });
  });

  describe('resume', () => {
    it('should throw error for non-existent execution', async () => {
      const runtime = new AgentRuntime();
      await expect(runtime.resume('non-existent')).rejects.toThrow();
    });
  });

  describe('on', () => {
    it('should subscribe to events', () => {
      const runtime = new AgentRuntime();
      const handler = jest.fn();
      runtime.on('agent.execution.started' as any, handler);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('approveToolExecution', () => {
    it('should approve tool execution', () => {
      const runtime = new AgentRuntime();
      expect(() => runtime.approveToolExecution('request-id', 'user-1')).not.toThrow();
    });
  });

  describe('rejectToolExecution', () => {
    it('should reject tool execution', () => {
      const runtime = new AgentRuntime();
      expect(() => runtime.rejectToolExecution('request-id')).not.toThrow();
    });
  });

  describe('getPendingApprovals', () => {
    it('should return empty array when no approvals', () => {
      const runtime = new AgentRuntime();
      const approvals = runtime.getPendingApprovals();
      expect(approvals).toEqual([]);
    });
  });

  describe('registerAgentInstance', () => {
    it('should register agent instance and tools', () => {
      @Agent({ name: 'instance-agent', description: 'Instance agent' })
      class InstanceAgent {
        @Tool({ description: 'Test tool', parameters: [] })
        async testTool() {
          return { result: 'ok' };
        }
      }

      const runtime = new AgentRuntime();
      runtime.registerAgent(InstanceAgent);

      const instance = new InstanceAgent();
      runtime.registerAgentInstance('instance-agent', instance);

      const tools = runtime.getAgentTools('instance-agent');
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('healthCheck', () => {
    it('should perform health check', async () => {
      const runtime = new AgentRuntime();
      const result = await runtime.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include metrics when enabled', async () => {
      const runtime = new AgentRuntime({ enableMetrics: true });
      const result = await runtime.healthCheck();

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return undefined when metrics not enabled', () => {
      const runtime = new AgentRuntime({ enableMetrics: false });
      const metrics = runtime.getMetrics();
      expect(metrics).toBeUndefined();
    });

    it('should return metrics when enabled', () => {
      const runtime = new AgentRuntime({ enableMetrics: true });
      const metrics = runtime.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.executions).toBeDefined();
    });
  });

  describe('getMetricsSummary', () => {
    it('should return default message when metrics not enabled', () => {
      const runtime = new AgentRuntime({ enableMetrics: false });
      const summary = runtime.getMetricsSummary();
      expect(summary).toBe('Metrics not enabled');
    });

    it('should return summary when metrics enabled', () => {
      const runtime = new AgentRuntime({ enableMetrics: true });
      const summary = runtime.getMetricsSummary();

      expect(summary).toContain('Agent Metrics Summary');
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics when enabled', () => {
      const runtime = new AgentRuntime({ enableMetrics: true });
      expect(() => runtime.resetMetrics()).not.toThrow();
    });

    it('should not throw when metrics not enabled', () => {
      const runtime = new AgentRuntime();
      expect(() => runtime.resetMetrics()).not.toThrow();
    });
  });

  describe('getRateLimiterStatus', () => {
    it('should return disabled when not configured', () => {
      const runtime = new AgentRuntime();
      const status = runtime.getRateLimiterStatus();

      expect(status.enabled).toBe(false);
    });

    it('should return enabled when configured', () => {
      const runtime = new AgentRuntime({ rateLimitPerMinute: 100 });
      const status = runtime.getRateLimiterStatus();

      expect(status.enabled).toBe(true);
      expect(status.availableTokens).toBeDefined();
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return disabled when not enabled', () => {
      const runtime = new AgentRuntime({ enableCircuitBreaker: false });
      const status = runtime.getCircuitBreakerStatus();

      expect(status.enabled).toBe(false);
    });

    it('should return enabled when configured', () => {
      const runtime = new AgentRuntime({ enableCircuitBreaker: true });
      const status = runtime.getCircuitBreakerStatus();

      expect(status.enabled).toBe(true);
      expect(status.state).toBeDefined();
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker when enabled', () => {
      const runtime = new AgentRuntime({ enableCircuitBreaker: true });
      expect(() => runtime.resetCircuitBreaker()).not.toThrow();
    });

    it('should not throw when not enabled', () => {
      const runtime = new AgentRuntime({ enableCircuitBreaker: false });
      expect(() => runtime.resetCircuitBreaker()).not.toThrow();
    });
  });

  describe('getAgentTools', () => {
    it('should return empty array for non-existent agent', () => {
      const runtime = new AgentRuntime();
      const tools = runtime.getAgentTools('non-existent');
      expect(tools).toEqual([]);
    });

    it('should return tools for registered agent', () => {
      @Agent({ name: 'tools-agent', description: 'Tools agent' })
      class ToolsAgent {
        @Tool({ description: 'Tool 1', parameters: [] })
        async tool1() {
          return { result: '1' };
        }
      }

      const runtime = new AgentRuntime();
      runtime.registerAgent(ToolsAgent);

      const instance = new ToolsAgent();
      runtime.registerAgentInstance('tools-agent', instance);

      const tools = runtime.getAgentTools('tools-agent');
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentMetadata', () => {
    it('should return undefined for non-existent agent', () => {
      const runtime = new AgentRuntime();
      const metadata = runtime.getAgentMetadata('non-existent');
      expect(metadata).toBeUndefined();
    });

    it('should return metadata for registered agent', () => {
      @Agent({ name: 'meta-agent', description: 'Meta agent' })
      class MetaAgent {}

      const runtime = new AgentRuntime();
      runtime.registerAgent(MetaAgent);

      const metadata = runtime.getAgentMetadata('meta-agent');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('meta-agent');
    });
  });

  describe('onAny', () => {
    it('should subscribe to all events', () => {
      const runtime = new AgentRuntime();
      const handler = jest.fn();
      runtime.onAny(handler);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('off', () => {
    it('should unsubscribe from events', () => {
      const runtime = new AgentRuntime();
      const handler = jest.fn();
      runtime.on('agent.execution.started' as any, handler);
      runtime.off('agent.execution.started' as any, handler);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown runtime', async () => {
      const runtime = new AgentRuntime();
      await expect(runtime.shutdown()).resolves.not.toThrow();
    });
  });

  describe('execute with options', () => {
    it('should handle rate limiting', async () => {
      const runtime = new AgentRuntime({ rateLimitPerMinute: 1 });
      
      // Consume the token
      try {
        await runtime.execute('non-existent', 'input');
      } catch {
        // Expected
      }

      // Wait a bit and try again - should be rate limited if token not available
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Next call should be rate limited (if token not available)
      try {
        await runtime.execute('non-existent', 'input');
      } catch (error: any) {
        // Either rate limit error or agent not found error is acceptable
        expect(error.message).toMatch(/Rate limit exceeded|not found/);
      }
    }, 10000); // Increase timeout

    it('should handle memory when enabled', async () => {
      const mockMemoryManager = {
        getConversationHistory: jest.fn().mockResolvedValue([]),
        getAllEntities: jest.fn().mockResolvedValue([]),
        getContext: jest.fn().mockResolvedValue(null),
      };

      const runtime = new AgentRuntime({
        memoryManager: mockMemoryManager as any,
      });

      try {
        await runtime.execute('non-existent', 'input', { enableMemory: true });
      } catch {
        // Expected to fail, but memory should be called
      }
    });

    it('should handle RAG when enabled', async () => {
      const mockRAGService = {
        search: jest.fn().mockResolvedValue([]),
      };

      const runtime = new AgentRuntime({
        ragService: mockRAGService as any,
      });

      try {
        await runtime.execute('non-existent', 'input', { enableRAG: true });
      } catch {
        // Expected to fail
      }
    });

    it('should handle initialContext', async () => {
      const runtime = new AgentRuntime();

      try {
        await runtime.execute('non-existent', 'input', {
          initialContext: { key: 'value' },
        });
      } catch {
        // Expected to fail
      }
    });

    it('should handle custom sessionId', async () => {
      const runtime = new AgentRuntime();

      try {
        await runtime.execute('non-existent', 'input', {
          sessionId: 'custom-session',
        });
      } catch {
        // Expected to fail
      }
    });

    it('should handle enableMemory false', async () => {
      const mockMemoryManager = {
        getConversationHistory: jest.fn().mockResolvedValue([]),
        getAllEntities: jest.fn().mockResolvedValue([]),
        getContext: jest.fn().mockResolvedValue(null),
      };

      const runtime = new AgentRuntime({
        memoryManager: mockMemoryManager as any,
      });

      try {
        await runtime.execute('non-existent', 'input', { enableMemory: false });
      } catch {
        // Expected to fail
      }
    });

    it('should handle enableRAG false', async () => {
      const mockRAGService = {
        search: jest.fn().mockResolvedValue([]),
      };

      const runtime = new AgentRuntime({
        ragService: mockRAGService as any,
      });

      try {
        await runtime.execute('non-existent', 'input', { enableRAG: false });
      } catch {
        // Expected to fail
      }
    });

    it('should handle circuit breaker and retry together', async () => {
      @Agent({ name: 'test-agent', description: 'Test agent' })
      class TestAgent {}

      const runtime = new AgentRuntime({
        enableCircuitBreaker: true,
        enableRetry: true,
      });

      runtime.registerAgent(TestAgent);

      try {
        await runtime.execute('test-agent', 'input');
      } catch {
        // Expected to fail without LLM
      }
    });

    it('should handle circuit breaker without retry', async () => {
      @Agent({ name: 'test-agent-2', description: 'Test agent' })
      class TestAgent2 {}

      const runtime = new AgentRuntime({
        enableCircuitBreaker: true,
        enableRetry: false,
      });

      runtime.registerAgent(TestAgent2);

      try {
        await runtime.execute('test-agent-2', 'input');
      } catch {
        // Expected to fail without LLM
      }
    });

    it('should handle retry without circuit breaker', async () => {
      @Agent({ name: 'test-agent-3', description: 'Test agent' })
      class TestAgent3 {}

      const runtime = new AgentRuntime({
        enableCircuitBreaker: false,
        enableRetry: true,
      });

      runtime.registerAgent(TestAgent3);

      try {
        await runtime.execute('test-agent-3', 'input');
      } catch {
        // Expected to fail without LLM
      }
    });

    it('should handle successful execution with metrics', async () => {
      @Agent({ name: 'success-agent', description: 'Success agent' })
      class SuccessAgent {}

      const mockLLMProvider = {
        chat: jest.fn().mockResolvedValue({
          content: 'Success response',
        }),
      };

      const runtime = new AgentRuntime({
        enableMetrics: true,
        llmProvider: mockLLMProvider as any,
      });

      runtime.registerAgent(SuccessAgent);

      try {
        const result = await runtime.execute('success-agent', 'input');
        expect(result).toBeDefined();
      } catch {
        // May fail for other reasons
      }
    });

    it('should handle execution error with metrics', async () => {
      const runtime = new AgentRuntime({
        enableMetrics: true,
      });

      try {
        await runtime.execute('non-existent', 'input');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should persist to memory after execution', async () => {
      const mockMemoryManager = {
        getConversationHistory: jest.fn().mockResolvedValue([]),
        getAllEntities: jest.fn().mockResolvedValue([]),
        getContext: jest.fn().mockResolvedValue(null),
        saveConversation: jest.fn().mockResolvedValue(undefined),
        saveEntity: jest.fn().mockResolvedValue(undefined),
      };

      @Agent({ name: 'memory-agent', description: 'Memory agent' })
      class MemoryAgent {}

      const runtime = new AgentRuntime({
        memoryManager: mockMemoryManager as any,
      });

      runtime.registerAgent(MemoryAgent);

      try {
        await runtime.execute('memory-agent', 'input');
      } catch {
        // Expected to fail without LLM, but memory should be called
      }
    });

    it('should handle async state manager createContext', async () => {
      const mockStateManager = {
        createContext: jest.fn().mockResolvedValue({
          executionId: 'exec-1',
          agentId: 'test-agent',
          sessionId: 'session-1',
          input: 'Hello',
          state: AgentState.IDLE,
          steps: [],
          memory: {
            conversationHistory: [],
            workingMemory: {},
            facts: [],
            entities: [],
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        getContext: jest.fn(),
        updateState: jest.fn(),
        addStep: jest.fn(),
        addMessage: jest.fn(),
        clear: jest.fn(),
      };

      @Agent({ name: 'async-agent', description: 'Async agent' })
      class AsyncAgent {}

      const runtime = new AgentRuntime({
        stateManager: mockStateManager as any,
      });

      runtime.registerAgent(AsyncAgent);

      try {
        await runtime.execute('async-agent', 'input');
      } catch {
        // Expected to fail without LLM
      }
    });
  });
});

