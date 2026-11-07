import {
  createHazelAIDiagnosticsProvider,
  resolveGlobalHazelAIDiagnosticsProvider,
} from '../integrations/hazel-ai';

describe('Hazel AI integration', () => {
  it('creates provider from AIEnhancedService-like client', async () => {
    const provider = createHazelAIDiagnosticsProvider({
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          category: 'memory',
          confidence: 0.95,
          message: 'Heap pressure',
          suggestedStrategies: ['memory-cleanup'],
        }),
      }),
    });

    const result = await provider.diagnose(new Error('heap out of memory'), {
      target: 'Worker.process',
    });

    expect(result?.category).toBe('memory');
  });

  it('passes model and provider options through to complete', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        category: 'memory',
        confidence: 0.9,
        message: 'ok',
        suggestedStrategies: ['memory-cleanup'],
      }),
    });
    const provider = createHazelAIDiagnosticsProvider(
      { complete },
      { model: 'gpt-test', provider: 'openai' }
    );
    await provider.diagnose(new Error('oom'), { target: 'Worker' });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-test' }), {
      provider: 'openai',
    });
  });

  it('resolveGlobal returns undefined when container has no AIEnhancedService', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(
        '@hazeljs/ai',
        () => ({
          AIEnhancedService: class AIEnhancedService {},
        }),
        { virtual: true }
      );
      jest.doMock('@hazeljs/core', () => ({
        Container: {
          getInstance: () => ({
            has: () => false,
            resolve: () => {
              throw new Error('not registered');
            },
          }),
        },
      }));

      const { resolveGlobalHazelAIDiagnosticsProvider: resolve } =
        await import('../integrations/hazel-ai');
      expect(resolve()).toBeUndefined();
    });
  });

  it('resolveGlobal builds a provider when container has AIEnhancedService', async () => {
    await jest.isolateModulesAsync(async () => {
      const complete = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          category: 'timeout',
          confidence: 0.7,
          message: 'Upstream timeout',
          suggestedStrategies: ['auto-restart'],
        }),
      });
      class AIEnhancedService {
        complete = complete;
      }
      jest.doMock('@hazeljs/ai', () => ({ AIEnhancedService }), { virtual: true });
      jest.doMock('@hazeljs/core', () => ({
        Container: {
          getInstance: () => ({
            has: (token: unknown) => token === AIEnhancedService,
            resolve: () => new AIEnhancedService(),
          }),
        },
      }));

      const { resolveGlobalHazelAIDiagnosticsProvider: resolve } =
        await import('../integrations/hazel-ai');
      const provider = resolve({ model: 'm1' });
      expect(provider).toBeDefined();
      expect(typeof provider?.diagnose).toBe('function');
    });
  });

  it('resolveGlobal returns undefined when ai package cannot load', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(
        '@hazeljs/ai',
        () => {
          throw new Error('not installed');
        },
        { virtual: true }
      );

      const { resolveGlobalHazelAIDiagnosticsProvider: resolve } =
        await import('../integrations/hazel-ai');
      expect(resolve()).toBeUndefined();
    });
  });

  it('exports resolveGlobalHazelAIDiagnosticsProvider', () => {
    expect(typeof resolveGlobalHazelAIDiagnosticsProvider).toBe('function');
  });
});
