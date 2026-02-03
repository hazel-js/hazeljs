import { AgentContextBuilder } from '../../src/context/agent.context';
import { AgentContext, AgentState } from '../../src/types/agent.types';

describe('AgentContextBuilder', () => {
  let builder: AgentContextBuilder;
  let mockMemoryManager: any;

  beforeEach(() => {
    mockMemoryManager = {
      getConversationHistory: jest.fn().mockResolvedValue([]),
      getAllEntities: jest.fn().mockResolvedValue([]),
      getContext: jest.fn().mockResolvedValue(null),
      addMessage: jest.fn().mockResolvedValue(undefined),
      setContext: jest.fn().mockResolvedValue(undefined),
      getEntity: jest.fn().mockResolvedValue(null),
      updateEntity: jest.fn().mockResolvedValue(undefined),
      trackEntity: jest.fn().mockResolvedValue(undefined),
    };

    builder = new AgentContextBuilder(mockMemoryManager);
  });

  describe('buildWithMemory', () => {
    it('should build context with memory when memory manager is provided', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builder.buildWithMemory(context);

      expect(mockMemoryManager.getConversationHistory).toHaveBeenCalled();
      expect(mockMemoryManager.getAllEntities).toHaveBeenCalled();
    });

    it('should do nothing when memory manager is not provided', async () => {
      const builderWithoutMemory = new AgentContextBuilder();
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builderWithoutMemory.buildWithMemory(context);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('buildWithRAG', () => {
    it('should build context with RAG when RAG service is provided', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ragService = {
        search: jest.fn().mockResolvedValue([{ content: 'Result 1' }]),
      };

      await builder.buildWithRAG(context, ragService);

      expect(ragService.search).toHaveBeenCalled();
    });

    it('should do nothing when RAG service is not provided', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builder.buildWithRAG(context, undefined);

      expect(context.ragContext).toEqual([]);
    });
  });

  describe('persistToMemory', () => {
    it('should persist context to memory when memory manager is provided', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [
            {
              role: 'user',
              content: 'Hello',
              timestamp: new Date(),
            },
          ],
          entities: [],
          workingMemory: { key: 'value' },
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builder.persistToMemory(context);

      expect(mockMemoryManager.addMessage).toHaveBeenCalled();
      expect(mockMemoryManager.setContext).toHaveBeenCalled();
    });

    it('should do nothing when memory manager is not provided', async () => {
      const builderWithoutMemory = new AgentContextBuilder();
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: AgentState.IDLE,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builderWithoutMemory.persistToMemory(context);

      // Should not throw
      expect(true).toBe(true);
    });
  });
});

