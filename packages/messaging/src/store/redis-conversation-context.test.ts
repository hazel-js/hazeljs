/**
 * RedisConversationContextStore tests
 */
import { RedisConversationContextStore } from './redis-conversation-context';

describe('RedisConversationContextStore', () => {
  let store: RedisConversationContextStore;
  let mockClient: {
    data: Map<string, string>;
    get: (k: string) => Promise<string | null>;
    setex: (k: string, t: number, v: string) => Promise<string>;
    del: (k: string) => Promise<number>;
  };

  beforeEach(() => {
    mockClient = {
      data: new Map(),
      get: jest.fn(async (k: string) => mockClient.data.get(k) ?? null),
      setex: jest.fn(async (k: string, _t: number, v: string) => {
        mockClient.data.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (k: string) => {
        const had = mockClient.data.has(k);
        mockClient.data.delete(k);
        return had ? 1 : 0;
      }),
    };
    store = new RedisConversationContextStore({ client: mockClient, ttlSeconds: 3600 });
  });

  describe('getTurns', () => {
    it('returns empty array when key does not exist', async () => {
      const turns = await store.getTurns('s1');
      expect(turns).toEqual([]);
      expect(mockClient.get).toHaveBeenCalledWith('messaging:context:s1');
    });

    it('returns parsed turns from Redis', async () => {
      const stored = JSON.stringify([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ]);
      mockClient.data.set('messaging:context:s1', stored);

      const turns = await store.getTurns('s1');
      expect(turns).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ]);
    });

    it('returns empty array on invalid JSON', async () => {
      mockClient.data.set('messaging:context:s1', 'invalid-json');

      const turns = await store.getTurns('s1');
      expect(turns).toEqual([]);
    });
  });

  describe('appendTurn', () => {
    it('appends turn and persists to Redis', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hi' });
      await store.appendTurn('s1', { role: 'assistant', content: 'Hello!' });

      const stored = mockClient.data.get('messaging:context:s1');
      expect(stored).toBeDefined();
      const turns = JSON.parse(stored!);
      expect(turns).toHaveLength(2);
      expect(turns[0]).toEqual({ role: 'user', content: 'Hi' });
      expect(turns[1]).toEqual({ role: 'assistant', content: 'Hello!' });
    });

    it('trims to maxTurns*2 when exceeded', async () => {
      for (let i = 0; i < 25; i++) {
        await store.appendTurn(
          's1',
          { role: i % 2 === 0 ? 'user' : 'assistant', content: `msg${i}` },
          10
        );
      }
      const stored = mockClient.data.get('messaging:context:s1');
      const turns = JSON.parse(stored!);
      expect(turns.length).toBeLessThanOrEqual(20);
    });

    it('uses default TTL when not provided', async () => {
      const storeDefault = new RedisConversationContextStore({ client: mockClient });
      await storeDefault.appendTurn('s1', { role: 'user', content: 'Hi' });
      expect(mockClient.setex).toHaveBeenCalledWith(
        'messaging:context:s1',
        86400,
        expect.any(String)
      );
    });
  });

  describe('clearSession', () => {
    it('deletes key from Redis', async () => {
      await store.appendTurn('s1', { role: 'user', content: 'Hi' });
      await store.clearSession('s1');

      expect(mockClient.del).toHaveBeenCalledWith('messaging:context:s1');
      const turns = await store.getTurns('s1');
      expect(turns).toEqual([]);
    });
  });
});
