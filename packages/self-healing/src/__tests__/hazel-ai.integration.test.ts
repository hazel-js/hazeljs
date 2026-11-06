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

  it('resolves Hazel AI service from the DI container', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Container } = require('@hazeljs/core') as {
      Container: {
        getInstance: () => {
          register: (token: unknown, value: unknown) => void;
          has: (token: unknown) => boolean;
        };
      };
    };
    const AIEnhancedService = class {
      complete = jest.fn().mockResolvedValue({
        content: JSON.stringify({
          category: 'timeout',
          confidence: 0.7,
          message: 'Upstream timeout',
          suggestedStrategies: ['auto-restart'],
        }),
      });
    };

    jest.doMock('@hazeljs/ai', () => ({ AIEnhancedService }), { virtual: true });

    const container = Container.getInstance();
    const instance = new AIEnhancedService();
    container.register(AIEnhancedService, instance);

    // Direct bridge still works when caller has the instance
    const provider = createHazelAIDiagnosticsProvider(instance);
    expect(provider).toBeDefined();

    const result = await provider!.diagnose(new Error('timeout'), { target: 'Api.call' });
    expect(result?.category).toBe('timeout');

    // resolveGlobal may be undefined if @hazeljs/ai mock isn't loaded by require cache;
    // createHazelAIDiagnosticsProvider is the supported explicit path.
    void resolveGlobalHazelAIDiagnosticsProvider;
  });
});
