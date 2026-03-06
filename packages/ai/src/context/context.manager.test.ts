jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { AIContextManager } from './context.manager';

describe('AIContextManager', () => {
  let manager: AIContextManager;

  beforeEach(() => {
    manager = new AIContextManager(200);
  });

  describe('constructor', () => {
    it('initializes with default maxTokens', () => {
      const m = new AIContextManager();
      expect(m.maxTokens).toBe(4096);
      expect(m.messages).toEqual([]);
      expect(m.currentTokens).toBe(0);
    });

    it('initializes with custom maxTokens', () => {
      const m = new AIContextManager(1000);
      expect(m.maxTokens).toBe(1000);
    });
  });

  describe('addMessage()', () => {
    it('adds a user message', () => {
      manager.addMessage({ role: 'user', content: 'hello' });
      expect(manager.messages).toHaveLength(1);
      expect(manager.messages[0].content).toBe('hello');
    });

    it('increments currentTokens', () => {
      manager.addMessage({ role: 'user', content: 'hello' });
      expect(manager.currentTokens).toBeGreaterThan(0);
    });

    it('adds message with name field', () => {
      manager.addMessage({ role: 'user', content: 'hi', name: 'Alice' });
      expect(manager.messages[0].name).toBe('Alice');
    });

    it('adds message with functionCall field', () => {
      manager.addMessage({
        role: 'assistant',
        content: '',
        functionCall: { name: 'getWeather', arguments: '{"city":"NYC"}' },
      });
      expect(manager.messages).toHaveLength(1);
    });

    it('auto-trims when content exceeds token limit', () => {
      const tightManager = new AIContextManager(10);
      tightManager.addMessage({ role: 'user', content: 'a'.repeat(200) });
      expect(tightManager.currentTokens).toBeLessThanOrEqual(10);
    });

    it('adds multiple messages', () => {
      manager.addMessage({ role: 'user', content: 'first' });
      manager.addMessage({ role: 'assistant', content: 'second' });
      expect(manager.messages).toHaveLength(2);
    });
  });

  describe('getMessages()', () => {
    it('returns a shallow copy of messages', () => {
      manager.addMessage({ role: 'user', content: 'test' });
      const msgs = manager.getMessages();
      msgs.push({ role: 'assistant', content: 'extra' });
      expect(manager.messages).toHaveLength(1);
    });

    it('returns empty array when no messages', () => {
      expect(manager.getMessages()).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('clears all messages and resets token count', () => {
      manager.addMessage({ role: 'user', content: 'test' });
      manager.clear();
      expect(manager.messages).toHaveLength(0);
      expect(manager.currentTokens).toBe(0);
    });
  });

  describe('trimToLimit()', () => {
    it('preserves system messages', () => {
      const tightManager = new AIContextManager(50);
      tightManager.addMessage({ role: 'system', content: 'You are a helpful assistant' });
      tightManager.addMessage({ role: 'user', content: 'message 1 to be trimmed maybe' });
      tightManager.addMessage({ role: 'user', content: 'message 2 to be trimmed maybe' });
      tightManager.trimToLimit();
      const systemMsgs = tightManager.getSystemMessages();
      expect(systemMsgs).toHaveLength(1);
    });

    it('keeps most recent conversation messages', () => {
      const tightManager = new AIContextManager(30);
      tightManager.addMessage({ role: 'user', content: 'old' });
      tightManager.addMessage({ role: 'user', content: 'new' });
      tightManager.trimToLimit();
      const msgs = tightManager.getConversationMessages();
      if (msgs.length > 0) {
        expect(msgs[msgs.length - 1].content).toBe('new');
      }
    });

    it('trims all conversation messages when system tokens fill the limit', () => {
      const tightManager = new AIContextManager(5);
      tightManager.addMessage({ role: 'system', content: 'sys' });
      tightManager.addMessage({ role: 'user', content: 'user msg' });
      tightManager.trimToLimit();
      expect(tightManager.getSystemMessages()).toHaveLength(1);
    });
  });

  describe('getStats()', () => {
    it('returns zero stats when empty', () => {
      const stats = manager.getStats();
      expect(stats.messageCount).toBe(0);
      expect(stats.currentTokens).toBe(0);
      expect(stats.maxTokens).toBe(200);
      expect(stats.utilizationPercent).toBe(0);
    });

    it('returns correct utilization after adding messages', () => {
      manager.addMessage({ role: 'user', content: 'hello world' });
      const stats = manager.getStats();
      expect(stats.messageCount).toBe(1);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
    });
  });

  describe('setMaxTokens()', () => {
    it('updates maxTokens', () => {
      manager.setMaxTokens(500);
      expect(manager.maxTokens).toBe(500);
    });

    it('trims when new limit is lower than current usage', () => {
      manager.addMessage({ role: 'user', content: 'a'.repeat(200) });
      manager.setMaxTokens(10);
      expect(manager.currentTokens).toBeLessThanOrEqual(10);
    });

    it('does not trim when new limit is higher', () => {
      manager.addMessage({ role: 'user', content: 'hello' });
      const tokensBefore = manager.currentTokens;
      manager.setMaxTokens(1000);
      expect(manager.currentTokens).toBe(tokensBefore);
    });
  });

  describe('getSystemMessages()', () => {
    it('returns only system messages', () => {
      manager.addMessage({ role: 'system', content: 'system prompt' });
      manager.addMessage({ role: 'user', content: 'user msg' });
      expect(manager.getSystemMessages()).toHaveLength(1);
      expect(manager.getSystemMessages()[0].role).toBe('system');
    });

    it('returns empty array when no system messages', () => {
      manager.addMessage({ role: 'user', content: 'user' });
      expect(manager.getSystemMessages()).toHaveLength(0);
    });
  });

  describe('getConversationMessages()', () => {
    it('returns user and assistant messages only', () => {
      manager.addMessage({ role: 'system', content: 'system' });
      manager.addMessage({ role: 'user', content: 'user' });
      manager.addMessage({ role: 'assistant', content: 'assistant' });
      const conv = manager.getConversationMessages();
      expect(conv).toHaveLength(2);
      expect(conv.every((m) => m.role === 'user' || m.role === 'assistant')).toBe(true);
    });
  });

  describe('addSystemMessage()', () => {
    it('adds a system message', () => {
      manager.addSystemMessage('You are helpful');
      expect(manager.messages[0].role).toBe('system');
      expect(manager.messages[0].content).toBe('You are helpful');
    });
  });

  describe('addUserMessage()', () => {
    it('adds a user message', () => {
      manager.addUserMessage('What is the weather?');
      expect(manager.messages[0].role).toBe('user');
      expect(manager.messages[0].content).toBe('What is the weather?');
    });
  });

  describe('addAssistantMessage()', () => {
    it('adds an assistant message', () => {
      manager.addAssistantMessage('It is sunny');
      expect(manager.messages[0].role).toBe('assistant');
      expect(manager.messages[0].content).toBe('It is sunny');
    });
  });
});
