/**
 * Integration test: AI task execution (post-0.9.0 migration path).
 */
import { AITaskExecutor } from '../../packages/ai/src/ai-task.executor';
import type { AITaskConfig } from '../../packages/ai/src/ai.types';

describe('AI integration', () => {
  it('AITaskExecutor handles custom provider tasks', async () => {
    const executor = new AITaskExecutor();
    const config: AITaskConfig = {
      name: 'noop',
      provider: 'custom',
      model: 'test',
      prompt: 'Return {input}',
      outputType: 'string',
      customProvider: {
        url: 'http://localhost:9999/mock',
        headers: {},
        transformRequest: (input) => ({ input }),
        transformResponse: (data: unknown) => (data as { input: string }).input,
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ input: 'integration-ok' }),
    }) as unknown as typeof fetch;

    const result = await executor.executeTask(config, { value: 'test' });
    expect(result.data).toBe('integration-ok');
  });
});
