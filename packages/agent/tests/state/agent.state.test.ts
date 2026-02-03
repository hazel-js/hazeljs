import { AgentStateManager } from '../../src/state/agent.state';
import { AgentState } from '../../src/types/agent.types';

describe('AgentStateManager', () => {
  let stateManager: AgentStateManager;

  beforeEach(() => {
    stateManager = new AgentStateManager();
  });

  describe('createContext', () => {
    it('should create a new execution context', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello', 'user-1');

      expect(context.agentId).toBe('agent-1');
      expect(context.sessionId).toBe('session-1');
      expect(context.input).toBe('Hello');
      expect(context.userId).toBe('user-1');
      expect(context.state).toBe(AgentState.IDLE);
      expect(context.executionId).toBeDefined();
      expect(context.steps).toEqual([]);
      expect(context.memory).toBeDefined();
    });

    it('should create context with metadata', () => {
      const metadata = { custom: 'value' };
      const context = stateManager.createContext(
        'agent-1',
        'session-1',
        'Hello',
        undefined,
        metadata
      );

      expect(context.metadata).toEqual(metadata);
    });

    it('should initialize memory correctly', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      expect(context.memory.conversationHistory).toEqual([]);
      expect(context.memory.workingMemory).toEqual({});
      expect(context.memory.facts).toEqual([]);
      expect(context.memory.entities).toEqual([]);
    });
  });

  describe('getContext', () => {
    it('should return context by execution ID', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const retrieved = stateManager.getContext(context.executionId);

      expect(retrieved).toEqual(context);
    });

    it('should return undefined for non-existent context', () => {
      const retrieved = stateManager.getContext('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('should update agent state', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const beforeUpdate = context.updatedAt;

      stateManager.updateState(context.executionId, AgentState.THINKING);

      expect(context.state).toBe(AgentState.THINKING);
      expect(context.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should throw error if context not found', () => {
      expect(() => stateManager.updateState('non-existent', AgentState.THINKING)).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('addStep', () => {
    it('should add a step to execution', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const step = {
        id: 'step-1',
        agentId: 'agent-1',
        executionId: context.executionId,
        stepNumber: 1,
        state: AgentState.THINKING,
        timestamp: new Date(),
      };

      stateManager.addStep(context.executionId, step);

      expect(context.steps).toHaveLength(1);
      expect(context.steps[0]).toEqual(step);
    });

    it('should throw error if context not found', () => {
      const step = {
        id: 'step-1',
        agentId: 'agent-1',
        executionId: 'exec-1',
        stepNumber: 1,
        state: AgentState.THINKING,
        timestamp: new Date(),
      };

      expect(() => stateManager.addStep('non-existent', step)).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('updateLastStep', () => {
    it('should update the last step', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const step = {
        id: 'step-1',
        agentId: 'agent-1',
        executionId: context.executionId,
        stepNumber: 1,
        state: AgentState.THINKING,
        timestamp: new Date(),
      };

      stateManager.addStep(context.executionId, step);
      stateManager.updateLastStep(context.executionId, { duration: 100 });

      expect(context.steps[0].duration).toBe(100);
    });

    it('should throw error if no steps exist', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      expect(() => stateManager.updateLastStep(context.executionId, { duration: 100 })).toThrow(
        'No steps to update'
      );
    });

    it('should throw error if context not found', () => {
      expect(() => stateManager.updateLastStep('non-existent', { duration: 100 })).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('deleteContext', () => {
    it('should delete context', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const executionId = context.executionId;

      stateManager.deleteContext(executionId);

      expect(stateManager.getContext(executionId)).toBeUndefined();
    });

    it('should not throw if context does not exist', () => {
      expect(() => stateManager.deleteContext('non-existent')).not.toThrow();
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation history', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      stateManager.addMessage(context.executionId, 'user', 'Hello there');

      expect(context.memory.conversationHistory).toHaveLength(1);
      expect(context.memory.conversationHistory[0].role).toBe('user');
      expect(context.memory.conversationHistory[0].content).toBe('Hello there');
    });

    it('should throw error if context not found', () => {
      expect(() => stateManager.addMessage('non-existent', 'user', 'Hello')).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('setWorkingMemory and getWorkingMemory', () => {
    it('should set and get working memory', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      stateManager.setWorkingMemory(context.executionId, 'key1', 'value1');
      const value = stateManager.getWorkingMemory(context.executionId, 'key1');

      expect(value).toBe('value1');
    });

    it('should throw error if context not found', () => {
      expect(() => stateManager.setWorkingMemory('non-existent', 'key', 'value')).toThrow(
        'Execution context non-existent not found'
      );
      expect(() => stateManager.getWorkingMemory('non-existent', 'key')).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('addRAGContext', () => {
    it('should add RAG context', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      stateManager.addRAGContext(context.executionId, ['context1', 'context2']);

      expect(context.ragContext).toEqual(['context1', 'context2']);
    });

    it('should throw error if context not found', () => {
      expect(() => stateManager.addRAGContext('non-existent', [])).toThrow(
        'Execution context non-existent not found'
      );
    });
  });

  describe('canContinue', () => {
    it('should return true if execution can continue', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');

      expect(stateManager.canContinue(context.executionId, 10)).toBe(true);
    });

    it('should return false if context not found', () => {
      expect(stateManager.canContinue('non-existent', 10)).toBe(false);
    });

    it('should return false if state is COMPLETED', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      stateManager.updateState(context.executionId, AgentState.COMPLETED);

      expect(stateManager.canContinue(context.executionId, 10)).toBe(false);
    });

    it('should return false if state is FAILED', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      stateManager.updateState(context.executionId, AgentState.FAILED);

      expect(stateManager.canContinue(context.executionId, 10)).toBe(false);
    });

    it('should return false if max steps reached', () => {
      const context = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const step = {
        id: 'step-1',
        agentId: 'agent-1',
        executionId: context.executionId,
        stepNumber: 1,
        state: AgentState.THINKING,
        timestamp: new Date(),
      };

      for (let i = 0; i < 10; i++) {
        stateManager.addStep(context.executionId, { ...step, stepNumber: i + 1 });
      }

      expect(stateManager.canContinue(context.executionId, 10)).toBe(false);
    });
  });

  describe('getSessionContexts', () => {
    it('should return contexts for a session', () => {
      const context1 = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const context2 = stateManager.createContext('agent-1', 'session-1', 'Hi');
      const context3 = stateManager.createContext('agent-2', 'session-2', 'Hey');

      const contexts = stateManager.getSessionContexts('session-1');

      expect(contexts).toHaveLength(2);
      expect(contexts).toContain(context1);
      expect(contexts).toContain(context2);
      expect(contexts).not.toContain(context3);
    });

    it('should return empty array if no contexts for session', () => {
      const contexts = stateManager.getSessionContexts('non-existent');
      expect(contexts).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all contexts', () => {
      const context1 = stateManager.createContext('agent-1', 'session-1', 'Hello');
      const context2 = stateManager.createContext('agent-2', 'session-2', 'Hi');

      stateManager.clear();

      expect(stateManager.getContext(context1.executionId)).toBeUndefined();
      expect(stateManager.getContext(context2.executionId)).toBeUndefined();
    });
  });
});

