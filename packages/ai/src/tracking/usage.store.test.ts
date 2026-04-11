import { InMemoryUsageStore } from './usage.store';

describe('InMemoryUsageStore', () => {
  it('save appends records', async () => {
    const store = new InMemoryUsageStore();
    await store.save({
      userId: 'u1',
      provider: 'openai',
      model: 'gpt-4',
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const all = await store.query({});
    expect(all).toHaveLength(1);
    expect(all[0].totalTokens).toBe(3);
  });

  it('query filters by userId', async () => {
    const store = new InMemoryUsageStore();
    await store.save({
      userId: 'a',
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 0,
      totalTokens: 1,
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    await store.save({
      userId: 'b',
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 0,
      totalTokens: 1,
      createdAt: '2025-01-02T00:00:00.000Z',
    });
    const filtered = await store.query({ userId: 'a' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].userId).toBe('a');
  });

  it('query filters by since', async () => {
    const store = new InMemoryUsageStore();
    await store.save({
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 0,
      totalTokens: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    await store.save({
      provider: 'openai',
      promptTokens: 1,
      completionTokens: 0,
      totalTokens: 1,
      createdAt: '2025-01-05T00:00:00.000Z',
    });
    const filtered = await store.query({ since: '2025-01-03T00:00:00.000Z' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].createdAt.startsWith('2025-01-05')).toBe(true);
  });
});
