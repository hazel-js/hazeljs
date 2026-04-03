import { createMemoryStore, MemoryCategory, MemoryService } from '@hazeljs/memory';
import { HazelAI } from '../../hazel-ai';
import { HCELError } from '../hcel.error';

describe('HCEL @hazeljs/memory integration', () => {
  let ai: HazelAI;
  let memory: MemoryService;

  beforeEach(async () => {
    ai = new HazelAI();
    const store = createMemoryStore({ type: 'in-memory' });
    memory = new MemoryService(store);
    await memory.initialize();
    jest.spyOn(ai, 'chat').mockResolvedValue('assistant reply');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('memoryRecall prepends formatted memories to the prompt input', async () => {
    await memory.save({
      userId: 'u1',
      category: MemoryCategory.EPISODIC,
      key: 'fact',
      value: 'User likes TypeScript',
      confidence: 1,
      source: 'explicit',
      evidence: [],
    });

    await ai.hazel
      .memory(memory)
      .context({ userId: 'u1' })
      .memoryRecall({ category: MemoryCategory.EPISODIC, limit: 5 })
      // Empty template forwards the recall-enriched string as the user message
      .prompt('')
      .execute('hello');

    const prompt = (ai.chat as jest.Mock).mock.calls[0][0] as string;
    expect(prompt).toContain('User likes TypeScript');
    expect(prompt).toContain('hello');
  });

  it('memorySave persists the previous string output', async () => {
    await ai.hazel
      .memory(memory)
      .context({ userId: 'u1', sessionId: 'sess-1' })
      .prompt('x')
      .memorySave({ category: MemoryCategory.SEMANTIC_SUMMARY, key: 'turn' })
      .execute('hi');

    const items = await memory.getByUserAndCategory('u1', MemoryCategory.SEMANTIC_SUMMARY, {
      limit: 10,
    });
    expect(items.some((i) => i.key === 'turn' && i.value === 'assistant reply')).toBe(true);
  });

  it('memorySearch passes through when store has no hits', async () => {
    await ai.hazel
      .memory(memory)
      .context({ userId: 'u1' })
      .memorySearch({ category: MemoryCategory.EPISODIC, topK: 3 })
      .prompt('')
      .execute('query text');

    const prompt = (ai.chat as jest.Mock).mock.calls[0][0] as string;
    expect(prompt).toContain('query text');
  });

  it('throws HCELError when memoryRecall runs without builder.memory()', async () => {
    await expect(
      ai.hazel
        .context({ userId: 'u1' })
        .memoryRecall({ category: MemoryCategory.PROFILE })
        .prompt('x')
        .execute('y')
    ).rejects.toThrow(HCELError);
  });
});
