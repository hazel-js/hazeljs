import { AgentContextBuilder } from '../../src/context/agent.context';
import { AgentContext } from '../../src/types/agent.types';
import { MemoryManager, Message, Entity } from '@hazeljs/rag';

describe('AgentContextBuilder', () => {
  let builder: AgentContextBuilder;
  let mockMemoryManager: jest.Mocked<MemoryManager>;

  beforeEach(() => {
    mockMemoryManager = {
      getConversationHistory: jest.fn(),
      getAllEntities: jest.fn(),
      getContext: jest.fn(),
      addMessage: jest.fn(),
      setContext: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn(),
      trackEntity: jest.fn(),
    } as any;

    builder = new AgentContextBuilder(mockMemoryManager);
  });

  describe('buildWithMemory', () => {
    it('should build context with conversation history', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

      const messages: Message[] = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
        },
      ];

      mockMemoryManager.getConversationHistory.mockResolvedValue(messages);
      mockMemoryManager.getAllEntities.mockResolvedValue([]);
      mockMemoryManager.getContext.mockResolvedValue(null);

      await builder.buildWithMemory(context);

      expect(context.memory.conversationHistory).toHaveLength(2);
      expect(context.memory.conversationHistory[0].role).toBe('user');
      expect(context.memory.conversationHistory[0].content).toBe('Hello');
    });

    it('should build context with entities', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

      const entities: Entity[] = [
        {
          name: 'John',
          type: 'person',
          attributes: { age: 30 },
          relationships: [],
          firstSeen: new Date(),
          lastSeen: new Date(),
          mentions: 1,
        },
      ];

      mockMemoryManager.getConversationHistory.mockResolvedValue([]);
      mockMemoryManager.getAllEntities.mockResolvedValue(entities);
      mockMemoryManager.getContext.mockResolvedValue(null);

      await builder.buildWithMemory(context);

      expect(context.memory.entities).toHaveLength(1);
      expect(context.memory.entities[0].name).toBe('John');
      expect(context.memory.entities[0].type).toBe('person');
    });

    it('should build context with working memory', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

      mockMemoryManager.getConversationHistory.mockResolvedValue([]);
      mockMemoryManager.getAllEntities.mockResolvedValue([]);
      mockMemoryManager.getContext.mockImplementation((key: string) => {
        if (key === 'current_task') return Promise.resolve('test task');
        if (key === 'user_preferences') return Promise.resolve({ theme: 'dark' });
        return Promise.resolve(null);
      });

      await builder.buildWithMemory(context);

      expect(context.memory.workingMemory.current_task).toBe('test task');
      expect(context.memory.workingMemory.user_preferences).toEqual({ theme: 'dark' });
    });

    it('should use custom maxHistory', async () => {
      mockMemoryManager.getConversationHistory.mockResolvedValue([]);
      mockMemoryManager.getAllEntities.mockResolvedValue([]);
      mockMemoryManager.getContext.mockResolvedValue(null);

      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

      await builder.buildWithMemory(context, 10);

      expect(mockMemoryManager.getConversationHistory).toHaveBeenCalledWith('session-1', 10);
    });

    it('should do nothing if memory manager is not provided', async () => {
      const builderWithoutMemory = new AgentContextBuilder();
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

      expect(context.memory.conversationHistory).toEqual([]);
    });
  });

  describe('buildWithRAG', () => {
    it('should build context with RAG results', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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
        search: jest.fn().mockResolvedValue([{ content: 'Result 1' }, { content: 'Result 2' }]),
      };

      await builder.buildWithRAG(context, ragService, 5);

      expect(context.ragContext).toEqual(['Result 1', 'Result 2']);
      expect(ragService.search).toHaveBeenCalledWith('Hello', { topK: 5 });
    });

    it('should handle RAG service errors', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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
        search: jest.fn().mockRejectedValue(new Error('RAG error')),
      };

      await builder.buildWithRAG(context, ragService);

      expect(context.ragContext).toEqual([]);
    });

    it('should handle results with text property', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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
        search: jest.fn().mockResolvedValue([{ text: 'Text Result 1' }, { text: 'Text Result 2' }]),
      };

      await builder.buildWithRAG(context, ragService);

      expect(context.ragContext).toEqual(['Text Result 1', 'Text Result 2']);
    });

    it('should use custom topK', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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
        search: jest.fn().mockResolvedValue([]),
      };

      await builder.buildWithRAG(context, ragService, 10);

      expect(ragService.search).toHaveBeenCalledWith('Hello', { topK: 10 });
    });

    it('should do nothing if RAG service is not provided', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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
    it('should persist conversation history', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
        steps: [],
        memory: {
          conversationHistory: [
            {
              role: 'user',
              content: 'Hello',
              timestamp: new Date(),
            },
            {
              role: 'assistant',
              content: 'Hi!',
              timestamp: new Date(),
            },
          ],
          entities: [],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builder.persistToMemory(context);

      expect(mockMemoryManager.addMessage).toHaveBeenCalledTimes(2);
    });

    it('should persist working memory', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [],
          workingMemory: {
            current_task: 'test',
            user_preferences: { theme: 'dark' },
          },
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await builder.persistToMemory(context);

      expect(mockMemoryManager.setContext).toHaveBeenCalledWith(
        'current_task',
        'test',
        'session-1'
      );
      expect(mockMemoryManager.setContext).toHaveBeenCalledWith(
        'user_preferences',
        { theme: 'dark' },
        'session-1'
      );
    });

    it('should update existing entities', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [
            {
              name: 'John',
              type: 'person',
              attributes: { age: 30 },
            },
          ],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMemoryManager.getEntity.mockResolvedValue({
        name: 'John',
        type: 'person',
        attributes: {},
        relationships: [],
        firstSeen: new Date(),
        lastSeen: new Date(),
        mentions: 1,
      });

      await builder.persistToMemory(context);

      expect(mockMemoryManager.updateEntity).toHaveBeenCalledWith('John', {
        name: 'John',
        type: 'person',
        attributes: { age: 30 },
      });
    });

    it('should track new entities', async () => {
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
        steps: [],
        memory: {
          conversationHistory: [],
          entities: [
            {
              name: 'Jane',
              type: 'person',
              attributes: { age: 25 },
            },
          ],
          workingMemory: {},
          facts: [],
        },
        ragContext: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMemoryManager.getEntity.mockResolvedValue(null);

      await builder.persistToMemory(context);

      expect(mockMemoryManager.trackEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane',
          type: 'person',
          attributes: { age: 25 },
        }),
        'session-1'
      );
    });

    it('should do nothing if memory manager is not provided', async () => {
      const builderWithoutMemory = new AgentContextBuilder();
      const context: AgentContext = {
        agentId: 'test-agent',
        executionId: 'exec-1',
        sessionId: 'session-1',
        userId: 'user-1',
        input: 'Hello',
        state: 'idle' as any,
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

  describe('buildWithCAG', () => {
    const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
      agentId: 'test-agent',
      executionId: 'exec-1',
      sessionId: 'session-1',
      userId: 'user-1',
      input: 'Hello',
      state: 'idle' as any,
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
      ...overrides,
    });

    it('loads cached context text', async () => {
      const context = makeContext();
      const cagService = {
        getContext: jest.fn().mockResolvedValue({ context: { text: 'cached policy' }, hit: true }),
      };

      await builder.buildWithCAG(context, cagService, { namespace: 'ops', tenantId: 'acme' });

      expect(context.cagContext).toEqual(['cached policy']);
      expect(cagService.getContext).toHaveBeenCalledWith({
        namespace: 'ops',
        tenantId: 'acme',
        agentId: 'test-agent',
      });
    });

    it('falls back to metadata tenantId, then userId, then default', async () => {
      const cagService = {
        getContext: jest.fn().mockResolvedValue({ context: { text: 'x' } }),
      };

      const fromMetadata = makeContext({ metadata: { tenantId: 'meta-tenant' } });
      await builder.buildWithCAG(fromMetadata, cagService);
      expect(cagService.getContext).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'meta-tenant', namespace: 'default' })
      );

      const fromUser = makeContext({ metadata: { tenantId: 12 }, userId: 'user-1' });
      await builder.buildWithCAG(fromUser, cagService);
      expect(cagService.getContext).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'user-1' })
      );

      const fromDefault = makeContext({ userId: undefined, metadata: {} });
      await builder.buildWithCAG(fromDefault, cagService);
      expect(cagService.getContext).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'default' })
      );
    });

    it('invokes onError and clears context when CAG throws', async () => {
      const context = makeContext();
      const onError = jest.fn();
      const cagService = {
        getContext: jest.fn().mockRejectedValue(new Error('cag down')),
      };

      await builder.buildWithCAG(context, cagService, { onError });

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'cag down' }));
      expect(context.cagContext).toEqual([]);
    });

    it('wraps non-Error throws and no-ops without a service', async () => {
      const context = makeContext();
      await builder.buildWithCAG(context, {
        getContext: jest.fn().mockRejectedValue('boom'),
      });
      expect(context.cagContext).toEqual([]);

      const untouched = makeContext();
      await builder.buildWithCAG(untouched, undefined as never);
      expect(untouched.cagContext).toBeUndefined();
    });
  });

  describe('buildWithKAG', () => {
    const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
      agentId: 'test-agent',
      executionId: 'exec-1',
      sessionId: 'session-1',
      userId: 'user-1',
      input: 'Who owns ORD-1001?',
      state: 'idle' as any,
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
      ...overrides,
    });

    it('stores answer, explanation, and confidence', async () => {
      const context = makeContext();
      const kagService = {
        ask: jest.fn().mockResolvedValue({
          answer: 'Acme',
          explanation: 'from graph',
          confidence: 0.91,
        }),
      };

      await builder.buildWithKAG(context, kagService, { graph: 'commerce', tenantId: 'acme' });

      expect(context.kagContext).toEqual(['Acme', 'from graph']);
      expect(context.metadata.kagConfidence).toBe(0.91);
      expect(kagService.ask).toHaveBeenCalledWith('Who owns ORD-1001?', {
        explain: true,
        tenantId: 'acme',
        graph: 'commerce',
      });
    });

    it('filters empty pieces and uses tenant fallbacks', async () => {
      const kagService = {
        ask: jest.fn().mockResolvedValue({ answer: '', explanation: undefined, confidence: 0.1 }),
      };
      const context = makeContext({ metadata: { tenantId: 'meta-k' } });
      await builder.buildWithKAG(context, kagService);
      expect(context.kagContext).toEqual([]);
      expect(kagService.ask).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ tenantId: 'meta-k' })
      );

      await builder.buildWithKAG(
        makeContext({ metadata: { tenantId: false }, userId: 'u1' }),
        kagService
      );
      expect(kagService.ask).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ tenantId: 'u1' })
      );

      await builder.buildWithKAG(makeContext({ userId: undefined, metadata: {} }), kagService);
      expect(kagService.ask).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ tenantId: 'default' })
      );
    });

    it('invokes onError and no-ops without a service', async () => {
      const context = makeContext();
      const onError = jest.fn();
      await builder.buildWithKAG(
        context,
        { ask: jest.fn().mockRejectedValue(new Error('kag down')) },
        { onError }
      );
      expect(onError).toHaveBeenCalled();
      expect(context.kagContext).toEqual([]);

      await builder.buildWithKAG(context, { ask: jest.fn().mockRejectedValue('nope') });
      expect(context.kagContext).toEqual([]);

      const skipped = makeContext();
      await builder.buildWithKAG(skipped, undefined as never);
      expect(skipped.kagContext).toBeUndefined();
    });
  });

  describe('buildWithUnifiedContext', () => {
    const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
      agentId: 'test-agent',
      executionId: 'exec-1',
      sessionId: 'session-1',
      userId: 'user-1',
      input: 'assemble me',
      state: 'idle' as any,
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
      ...overrides,
    });

    it('stores assembled text and plan metadata', async () => {
      const context = makeContext();
      const contextService = {
        assemble: jest.fn().mockResolvedValue({
          text: 'merged context',
          sourcesUsed: ['cag', 'rag'],
          plan: { rationale: ['cache first'] },
        }),
      };

      await builder.buildWithUnifiedContext(context, contextService, {
        tenantId: 'acme',
        namespace: 'ops',
      });

      expect(context.unifiedContext).toEqual(['merged context']);
      expect(context.metadata.contextSourcesUsed).toEqual(['cag', 'rag']);
      expect(context.metadata.contextPlanRationale).toEqual(['cache first']);
      expect(contextService.assemble).toHaveBeenCalledWith({
        query: 'assemble me',
        tenantId: 'acme',
        namespace: 'ops',
        agentId: 'test-agent',
        userId: 'user-1',
        sessionId: 'session-1',
      });
    });

    it('stores an empty array when assemble returns no text', async () => {
      const context = makeContext({ metadata: { tenantId: 'meta-u' } });
      const contextService = {
        assemble: jest.fn().mockResolvedValue({ text: '', plan: undefined }),
      };
      await builder.buildWithUnifiedContext(context, contextService);
      expect(context.unifiedContext).toEqual([]);
      expect(contextService.assemble).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'meta-u' })
      );
    });

    it('uses userId then default tenant and handles errors', async () => {
      const contextService = {
        assemble: jest.fn().mockResolvedValue({ text: 'ok' }),
      };
      await builder.buildWithUnifiedContext(
        makeContext({ metadata: { tenantId: null }, userId: 'u2' }),
        contextService
      );
      expect(contextService.assemble).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'u2' })
      );

      await builder.buildWithUnifiedContext(
        makeContext({ userId: undefined, metadata: {} }),
        contextService
      );
      expect(contextService.assemble).toHaveBeenLastCalledWith(
        expect.objectContaining({ tenantId: 'default' })
      );

      const failed = makeContext();
      const onError = jest.fn();
      await builder.buildWithUnifiedContext(
        failed,
        { assemble: jest.fn().mockRejectedValue(new Error('planner down')) },
        { onError }
      );
      expect(onError).toHaveBeenCalled();
      expect(failed.unifiedContext).toEqual([]);

      await builder.buildWithUnifiedContext(failed, {
        assemble: jest.fn().mockRejectedValue('raw'),
      });
      expect(failed.unifiedContext).toEqual([]);

      const skipped = makeContext();
      await builder.buildWithUnifiedContext(skipped, undefined as never);
      expect(skipped.unifiedContext).toBeUndefined();
    });
  });
});
