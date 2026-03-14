import type {
  RealtimeProvider,
  RealtimeSessionConfig,
  RealtimeModuleOptions,
  OpenAIVoice,
  RealtimeAudioFormat,
} from './realtime.types';

describe('realtime.types', () => {
  describe('RealtimeProvider', () => {
    it('should allow openai and gemini', () => {
      const providers: RealtimeProvider[] = ['openai', 'gemini'];
      expect(providers).toContain('openai');
      expect(providers).toContain('gemini');
    });
  });

  describe('RealtimeSessionConfig', () => {
    it('should accept valid config', () => {
      const config: RealtimeSessionConfig = {
        instructions: 'Be helpful',
        voice: 'marin',
        outputModalities: ['audio', 'text'],
        turnDetection: true,
      };
      expect(config.instructions).toBe('Be helpful');
      expect(config.voice).toBe('marin');
    });
  });

  describe('RealtimeModuleOptions', () => {
    it('should accept valid options', () => {
      const options: RealtimeModuleOptions = {
        defaultProvider: 'openai',
        openaiApiKey: 'sk-test',
        path: '/realtime',
        defaultSessionConfig: { instructions: 'Test' },
      };
      expect(options.path).toBe('/realtime');
    });
  });

  describe('OpenAIVoice', () => {
    it('should include standard voices', () => {
      const voices: OpenAIVoice[] = [
        'alloy',
        'ash',
        'ballad',
        'coral',
        'echo',
        'sage',
        'shimmer',
        'verse',
        'marin',
        'cedar',
      ];
      expect(voices).toHaveLength(10);
    });
  });

  describe('RealtimeAudioFormat', () => {
    it('should accept PCM formats', () => {
      const format: RealtimeAudioFormat = {
        type: 'audio/pcm',
        rate: 24000,
      };
      expect(format.type).toBe('audio/pcm');
      expect(format.rate).toBe(24000);
    });
  });
});
