import { RedisStateManager, RedisStateManagerConfig } from '../../src/state/redis-state.manager';
import { AgentState } from '../../src/types/agent.types';

describe('RedisStateManager', () => {
  let mockRedisClient: any;
  let manager: RedisStateManager;

  beforeEach(() => {
    mockRedisClient = {
      setEx: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      sAdd: jest.fn().mockResolvedValue(1),
      sMembers: jest.fn().mockResolvedValue([]),
      sRem: jest.fn().mockResolvedValue(1),
    };

    const config: RedisStateManagerConfig = {
      client: mockRedisClient,
    };

    manager = new RedisStateManager(config);
  });

  describe('constructor', () => {
    it('should throw error if client not provided', () => {
      expect(() => {
        new RedisStateManager({ client: null as any });
      }).toThrow('Redis client is required');
    });

    it('should create manager with default config', () => {
      const config: RedisStateManagerConfig = {
        client: mockRedisClient,
      };
      const manager = new RedisStateManager(config);
      expect(manager).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const config: RedisStateManagerConfig = {
        client: mockRedisClient,
        keyPrefix: 'custom:prefix:',
        defaultTTL: 7200,
        completedTTL: 172800,
        failedTTL: 1209600,
      };
      const manager = new RedisStateManager(config);
      expect(manager).toBeDefined();
    });
  });

  describe('createContext', () => {
    it('should create context', async () => {
      const result = await manager.createContext('agent-1', 'session-1', 'Hello', 'user-1');

      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.agentId).toBe('agent-1');
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('getContext', () => {
    it('should return context if found', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));

      const result = await manager.getContext('exec-1');

      expect(result).toBeDefined();
      expect(mockRedisClient.get).toHaveBeenCalled();
    });

    it('should return undefined if not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await manager.getContext('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('should update state', async () => {
      const mockContextForUpdate = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContextForUpdate));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.updateState('exec-1', AgentState.COMPLETED);

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('addStep', () => {
    it('should add step', async () => {
      const step = {
        id: 'step-1',
        agentId: 'agent-1',
        executionId: 'exec-1',
        stepNumber: 1,
        state: AgentState.THINKING,
        timestamp: new Date(),
      };

      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.addStep('exec-1', step);

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('addMessage', () => {
    it('should add message', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.addMessage('exec-1', 'user', 'Hello');

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('getSessionContexts', () => {
    it('should return contexts for session', async () => {
      mockRedisClient.sMembers.mockResolvedValue(['exec-1', 'exec-2']);

      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));

      const result = await manager.getSessionContexts('session-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all contexts', async () => {
      mockRedisClient.keys.mockResolvedValue(['key1', 'key2']);
      mockRedisClient.del.mockResolvedValue(2);

      await manager.clear();

      expect(mockRedisClient.keys).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should handle empty keys', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await manager.clear();

      expect(mockRedisClient.keys).toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('setWorkingMemory', () => {
    it('should set working memory', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.setWorkingMemory('exec-1', 'key', 'value');

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('getWorkingMemory', () => {
    it('should get working memory', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: { key: 'value' },
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));

      const result = await manager.getWorkingMemory('exec-1', 'key');

      expect(result).toBe('value');
    });
  });

  describe('addRAGContext', () => {
    it('should add RAG context', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.addRAGContext('exec-1', ['context1', 'context2']);

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('updateLastStep', () => {
    it('should update last step', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            executionId: 'exec-1',
            stepNumber: 1,
            state: AgentState.THINKING,
            timestamp: new Date().toISOString(),
          },
        ],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.setEx.mockResolvedValue('OK');

      await manager.updateLastStep('exec-1', { state: AgentState.COMPLETED });

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should throw error when no steps to update', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));

      await expect(manager.updateLastStep('exec-1', { state: AgentState.COMPLETED })).rejects.toThrow('No steps to update');
    });
  });

  describe('deleteContext', () => {
    it('should delete context', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        memory: {
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
        },
        ragContext: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockContext));
      mockRedisClient.sRem.mockResolvedValue(1);
      mockRedisClient.del.mockResolvedValue(1);

      await manager.deleteContext('exec-1');

      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });
});

