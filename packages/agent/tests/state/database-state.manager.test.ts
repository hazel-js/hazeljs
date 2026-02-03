import { DatabaseStateManager, DatabaseStateManagerConfig } from '../../src/state/database-state.manager';
import { AgentState } from '../../src/types/agent.types';

describe('DatabaseStateManager', () => {
  let mockPrismaClient: any;
  let manager: DatabaseStateManager;

  beforeEach(() => {
    mockPrismaClient = {
      agentContext: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const config: DatabaseStateManagerConfig = {
      client: mockPrismaClient,
    };

    manager = new DatabaseStateManager(config);
  });

  describe('constructor', () => {
    it('should throw error if client not provided', () => {
      expect(() => {
        new DatabaseStateManager({ client: null as any });
      }).toThrow('Prisma client is required');
    });

    it('should create manager with default config', () => {
      const config: DatabaseStateManagerConfig = {
        client: mockPrismaClient,
      };
      const manager = new DatabaseStateManager(config);
      expect(manager).toBeDefined();
    });

    it('should create manager with custom config', () => {
      const config: DatabaseStateManagerConfig = {
        client: mockPrismaClient,
        softDelete: false,
        autoArchive: true,
        archiveThresholdDays: 60,
      };
      const manager = new DatabaseStateManager(config);
      expect(manager).toBeDefined();
    });
  });

  describe('createContext', () => {
    it('should create context', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.THINKING,
        steps: [],
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.create.mockResolvedValue(mockContext);

      const result = await manager.createContext('agent-1', 'session-1', 'Hello', 'user-1');

      expect(result).toBeDefined();
      expect(mockPrismaClient.agentContext.create).toHaveBeenCalled();
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
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);

      const result = await manager.getContext('exec-1');

      expect(result).toBeDefined();
      expect(mockPrismaClient.agentContext.findUnique).toHaveBeenCalled();
    });

    it('should return undefined if not found', async () => {
      mockPrismaClient.agentContext.findUnique.mockResolvedValue(null);

      const result = await manager.getContext('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('should update state', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.updateState('exec-1', AgentState.COMPLETED);

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
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
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.addStep('exec-1', step);

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
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
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.addMessage('exec-1', 'user', 'Hello');

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
    });
  });

  describe('getSessionContexts', () => {
    it('should return contexts for session', async () => {
      const mockContexts = [
        {
          executionId: 'exec-1',
          agentId: 'agent-1',
          sessionId: 'session-1',
          state: AgentState.THINKING,
          steps: [],
          conversationHistory: [],
          workingMemory: {},
          facts: [],
          entities: [],
          ragContext: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaClient.agentContext.findMany.mockResolvedValue(mockContexts);

      const result = await manager.getSessionContexts('session-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all contexts', async () => {
      mockPrismaClient.agentContext.updateMany.mockResolvedValue({ count: 0 });

      await manager.clear();

      expect(mockPrismaClient.agentContext.updateMany).toHaveBeenCalled();
    });

    it('should use deleteMany when softDelete is false', async () => {
      const managerNoSoftDelete = new DatabaseStateManager({
        client: mockPrismaClient,
        softDelete: false,
      });

      mockPrismaClient.agentContext.deleteMany.mockResolvedValue({ count: 0 });

      await managerNoSoftDelete.clear();

      expect(mockPrismaClient.agentContext.deleteMany).toHaveBeenCalled();
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
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.setWorkingMemory('exec-1', 'key', 'value');

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
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
        conversationHistory: [],
        workingMemory: { key: 'value' },
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);

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
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.addRAGContext('exec-1', ['context1', 'context2']);

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
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
            timestamp: new Date(),
          },
        ],
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.updateLastStep('exec-1', { state: AgentState.COMPLETED });

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
    });

    it('should throw error when no steps to update', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);

      await expect(manager.updateLastStep('exec-1', { state: AgentState.COMPLETED })).rejects.toThrow('No steps to update');
    });
  });

  describe('deleteContext', () => {
    it('should soft delete when enabled', async () => {
      const mockContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        sessionId: 'session-1',
        state: AgentState.THINKING,
        steps: [],
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
        ragContext: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.agentContext.findUnique.mockResolvedValue(mockContext);
      mockPrismaClient.agentContext.update.mockResolvedValue({});

      await manager.deleteContext('exec-1');

      expect(mockPrismaClient.agentContext.update).toHaveBeenCalled();
    });

    it('should hard delete when softDelete is false', async () => {
      const managerNoSoftDelete = new DatabaseStateManager({
        client: mockPrismaClient,
        softDelete: false,
      });

      mockPrismaClient.agentContext.delete.mockResolvedValue({});

      await managerNoSoftDelete.deleteContext('exec-1');

      expect(mockPrismaClient.agentContext.delete).toHaveBeenCalled();
    });
  });
});

