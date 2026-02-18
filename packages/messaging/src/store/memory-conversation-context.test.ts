/**
 * MemoryConversationContextStore tests
 */
import { MemoryConversationContextStore } from './memory-conversation-context';

describe('MemoryConversationContextStore', () => {
  let store: MemoryConversationContextStore;

  beforeEach(() => {
    store = new MemoryConversationContextStore();
  });

  describe('getTurns', () => {
    it('returns empty array for unknown session', async () => {
      const turns = await store.getTurns('unknown-session');
      expect(turns).toEqual([]);
    });

    it('returns stored turns for known session', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hello' });
      const turns = await store.getTurns('s1');
      expect(turns).toEqual([{ role: 'user', content: 'Hello' }]);
    });
  });

  describe('appendTurn', () => {
    it('appends user and assistant turns', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hi' });
      await store.appendTurn('s1', { role: 'assistant', content: 'Hello!' });
      const turns = await store.getTurns('s1');
      expect(turns).toHaveLength(2);
      expect(turns[0]).toEqual({ role: 'user', content: 'Hi' });
      expect(turns[1]).toEqual({ role: 'assistant', content: 'Hello!' });
    });

    it('trims to maxTurns*2 when exceeded', async () => {
      for (let i = 0; i < 15; i++) {
        await store.appendTurn('s1', {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `msg${i}`,
        });
      }
      const turns = await store.getTurns('s1');
      expect(turns.length).toBeLessThanOrEqual(20);
      expect(turns[turns.length - 1].content).toBe('msg14');
    });

    it('does not trim when under maxTurns*2', async () => {
      for (let i = 0; i < 5; i++) {
        await store.appendTurn('s1', {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `msg${i}`,
        });
      }
      const turns = await store.getTurns('s1');
      expect(turns).toHaveLength(5);
    });
  });

  describe('clearSession', () => {
    it('removes session data', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hi' });
      await store.clearSession('s1');
      const turns = await store.getTurns('s1');
      expect(turns).toEqual([]);
    });

    it('does not affect other sessions', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hi' });
      await store.appendTurn('s2', { role: 'user', content: 'Bye' });
      await store.clearSession('s1');
      expect(await store.getTurns('s2')).toEqual([{ role: 'user', content: 'Bye' }]);
    });
  });
});
