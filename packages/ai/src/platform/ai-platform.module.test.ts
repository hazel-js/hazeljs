import { AIModule } from '../ai.module';
import { AIPlatformModule } from './ai-platform.module';

describe('AIPlatformModule', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    AIModule.register({});
    AIPlatformModule.forRoot({});
  });

  it('forRoot merges config and registers AIModule', () => {
    const M = AIPlatformModule.forRoot({
      defaultProvider: 'openai',
      providers: {
        openai: { apiKey: 'sk-test-key' },
      },
    });
    expect(M).toBe(AIPlatformModule);
    expect(AIPlatformModule.getConfig().defaultProvider).toBe('openai');
    expect(process.env.OPENAI_API_KEY).toBe('sk-test-key');
    const opts = AIModule.getOptions();
    expect(opts.defaultProvider).toBe('openai');
  });

  it('forRoot with empty config', () => {
    AIPlatformModule.forRoot({});
    expect(AIPlatformModule.getConfig()).toEqual({});
  });

  it('getConfig returns last forRoot payload', () => {
    AIPlatformModule.forRoot({ defaultProvider: 'ollama' });
    expect(AIPlatformModule.getConfig().defaultProvider).toBe('ollama');
  });
});
