/**
 * MessagingModule tests - tests forRoot without Kafka/Redis to avoid dynamic requires
 */
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(0),
  }));
});

jest.mock('@hazeljs/kafka', () => ({
  KafkaModule: { forRoot: jest.fn() },
  KafkaProducerService: {},
  KafkaSubscribe: () => () => {},
  KafkaConsumer: () => () => {},
}));

import { MessagingModule } from './messaging.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

describe('MessagingModule', () => {
  describe('forRoot', () => {
    it('returns dynamic module structure', () => {
      const result = MessagingModule.forRoot({
        systemPrompt: 'Test bot',
        channels: {
          telegram: { botToken: 'test-token' },
        },
      });

      expect(result).toHaveProperty('module', MessagingModule);
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('controllers');
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.controllers).toContain(MessagingController);
    });

    it('creates adapters for configured channels', () => {
      const result = MessagingModule.forRoot({
        channels: {
          telegram: { botToken: 't1' },
          whatsapp: {
            accessToken: 'a1',
            phoneNumberId: 'p1',
          },
        },
      });

      const adaptersProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useValue' in p &&
          Array.isArray((p as { useValue: unknown }).useValue)
      ) as { useValue: { channel: string }[] } | undefined;
      expect(adaptersProvider?.useValue).toHaveLength(2);
      expect(adaptersProvider?.useValue[0].channel).toBe('telegram');
      expect(adaptersProvider?.useValue[1].channel).toBe('whatsapp');
    });

    it('creates viber adapter when viber authToken provided', () => {
      const result = MessagingModule.forRoot({
        channels: {
          telegram: { botToken: 't1' },
          viber: { authToken: 'viber-auth' },
        },
      });

      const adaptersProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useValue' in p &&
          Array.isArray((p as { useValue: unknown }).useValue)
      ) as { useValue: { channel: string }[] } | undefined;
      expect(adaptersProvider?.useValue).toHaveLength(2);
      const channels = adaptersProvider?.useValue.map((a) => a.channel) ?? [];
      expect(channels).toContain('telegram');
      expect(channels).toContain('viber');
    });

    it('creates MessagingService with useFactory', () => {
      const result = MessagingModule.forRoot({
        channels: { telegram: { botToken: 't' } },
      });

      const svcProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useFactory' in p &&
          (p as { provide?: { name?: string } }).provide?.name === 'MessagingService'
      ) as { useFactory: () => unknown } | undefined;
      expect(svcProvider?.useFactory).toBeDefined();
      const service = svcProvider?.useFactory?.();
      expect(service).toBeInstanceOf(MessagingService);
    });

    it('does not include Kafka when kafka config absent', () => {
      const result = MessagingModule.forRoot({
        channels: { telegram: { botToken: 't' } },
      });

      const kafkaProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useValue' in p &&
          (p as { useValue: unknown }).useValue === null
      );
      expect(kafkaProvider).toBeDefined();
    });

    it('uses Redis with host/port when redis.client not provided', () => {
      const result = MessagingModule.forRoot({
        channels: { telegram: { botToken: 't' } },
        redis: { host: 'redis.example.com', port: 6380 },
      });

      const svcProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useFactory' in p &&
          (p as { provide?: { name?: string } }).provide?.name === 'MessagingService'
      ) as { useFactory: () => unknown } | undefined;
      const service = svcProvider?.useFactory?.();
      expect(service).toBeInstanceOf(MessagingService);
    });

    it('includes Kafka providers and imports when kafka config provided', () => {
      const result = MessagingModule.forRoot({
        channels: { telegram: { botToken: 't' } },
        kafka: { brokers: ['localhost:9092'] },
      });

      expect(result.imports).toBeDefined();
      expect(Array.isArray(result.imports)).toBe(true);
      expect(result.imports!.length).toBeGreaterThan(0);
    });

    it('uses RedisConversationContextStore when redis.client provided', () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(0),
      };
      const result = MessagingModule.forRoot({
        channels: { telegram: { botToken: 't' } },
        redis: {
          client: mockRedis,
          ttlSeconds: 7200,
        },
      });

      const svcProvider = result.providers?.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          'useFactory' in p &&
          (p as { provide?: { name?: string } }).provide?.name === 'MessagingService'
      ) as { useFactory: () => unknown } | undefined;
      const service = svcProvider?.useFactory?.();
      expect(service).toBeInstanceOf(MessagingService);
    });
  });

  describe('getOptions', () => {
    it('returns last forRoot options', () => {
      MessagingModule.forRoot({
        systemPrompt: 'Custom',
        model: 'gpt-4',
      });

      const opts = MessagingModule.getOptions();
      expect(opts.systemPrompt).toBe('Custom');
      expect(opts.model).toBe('gpt-4');
    });
  });
});
