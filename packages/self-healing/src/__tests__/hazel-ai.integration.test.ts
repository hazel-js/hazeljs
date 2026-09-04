import {
  createHazelAIDiagnosticsProvider,
  resolveGlobalHazelAIDiagnosticsProvider,
} from '../integrations/hazel-ai';

describe('Hazel AI integration', () => {
  afterEach(() => {
    delete (global as { __HAZELJS_AI_ENHANCED_SERVICE__?: unknown })
      .__HAZELJS_AI_ENHANCED_SERVICE__;
  });

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

  it('resolves global Hazel AI service', async () => {
    (global as { __HAZELJS_AI_ENHANCED_SERVICE__?: unknown }).__HAZELJS_AI_ENHANCED_SERVICE__ = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          category: 'timeout',
          confidence: 0.7,
          message: 'Upstream timeout',
          suggestedStrategies: ['auto-restart'],
        }),
      }),
    };

    const provider = resolveGlobalHazelAIDiagnosticsProvider();
    expect(provider).toBeDefined();

    const result = await provider!.diagnose(new Error('timeout'), { target: 'Api.call' });
    expect(result?.category).toBe('timeout');
  });
});
