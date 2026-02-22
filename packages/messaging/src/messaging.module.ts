/**
 * Messaging Module - Multichannel bot with LLM integration
 * Supports Kafka (async, horizontally scalable) and Redis (context store)
 */
import { HazelModule } from '@hazeljs/core';
import { MessagingService } from './messaging.service';
import {
  MessagingController,
  MESSAGING_ADAPTERS,
  MESSAGING_USE_KAFKA,
  MESSAGING_KAFKA_PRODUCER,
} from './messaging.controller';
import { TelegramAdapter } from './adapters/telegram.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { ViberAdapter } from './adapters/viber.adapter';
import { SlackAdapter } from './adapters/slack.adapter';
import { TeamsAdapter } from './adapters/teams.adapter';
import { RedisConversationContextStore } from './store/redis-conversation-context';
import { MemoryConversationContextStore } from './store/memory-conversation-context';
import type { MessagingServiceOptions } from './messaging.service';
import type { IChannelAdapter } from './types/message.types';
import type { KafkaModuleOptions } from '@hazeljs/kafka';

export interface MessagingModuleChannelConfig {
  telegram?: { botToken: string };
  whatsapp?: { accessToken: string; phoneNumberId: string; apiVersion?: string };
  viber?: { authToken: string };
  slack?: { webhookUrl: string };
  teams?: { webhookUrl: string };
}

/** Redis config - client or connection options */
export interface MessagingRedisConfig {
  client?: {
    get: (k: string) => Promise<string | null>;
    setex: (k: string, t: number, v: string) => Promise<string>;
    del: (k: string) => Promise<number>;
  };
  host?: string;
  port?: number;
  password?: string;
  /** TTL for context keys in seconds (default: 86400 = 24h) */
  ttlSeconds?: number;
}

export interface MessagingModuleOptions extends MessagingServiceOptions {
  channels?: MessagingModuleChannelConfig;
  /** Kafka config for async processing (horizontally scalable) */
  kafka?: Partial<KafkaModuleOptions>;
  /** Redis config for conversation context (horizontally scalable) */
  redis?: MessagingRedisConfig;
}

@HazelModule({
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {
  private static options: MessagingModuleOptions = {};

  /**
   * Configure MessagingModule with channels and AI.
   *
   * @example
   * ```ts
   * import { MessagingModule } from '@hazeljs/messaging';
   * import { OpenAIProvider } from '@hazeljs/ai';
   *
   * imports: [
   *   MessagingModule.forRoot({
   *     aiProvider: new OpenAIProvider(),
   *     systemPrompt: 'You are a helpful support bot.',
   *     channels: {
   *       telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN! },
   *       whatsapp: {
   *         accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
   *         phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
   *       },
   *     },
   *   }),
   * ]
   * ```
   */
  static forRoot(options: MessagingModuleOptions = {}): {
    module: typeof MessagingModule;
    imports?: unknown[];
    providers: unknown[];
    controllers: unknown[];
  } {
    MessagingModule.options = options;

    const channels = options.channels ?? {};
    const adapters: IChannelAdapter[] = [];
    const imports: unknown[] = [];

    if (channels.telegram?.botToken) {
      adapters.push(new TelegramAdapter({ botToken: channels.telegram.botToken }));
    }
    if (channels.whatsapp?.accessToken) {
      adapters.push(
        new WhatsAppAdapter({
          accessToken: channels.whatsapp.accessToken,
          phoneNumberId: channels.whatsapp.phoneNumberId,
          apiVersion: channels.whatsapp.apiVersion,
        })
      );
    }
    if (channels.viber?.authToken) {
      adapters.push(new ViberAdapter({ authToken: channels.viber.authToken }));
    }
    if (channels.slack?.webhookUrl) {
      adapters.push(new SlackAdapter({ webhookUrl: channels.slack.webhookUrl }));
    }
    if (channels.teams?.webhookUrl) {
      adapters.push(new TeamsAdapter({ webhookUrl: channels.teams.webhookUrl }));
    }

    const useKafka = !!options.kafka;

    let contextStore: MemoryConversationContextStore | RedisConversationContextStore;
    if (options.redis?.client) {
      contextStore = new RedisConversationContextStore({
        client: options.redis.client,
        ttlSeconds: options.redis.ttlSeconds,
      });
    } else if (options.redis?.host || options.redis?.port) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- ioredis is optional peer dep
      const Redis = require('ioredis');
      const client = new Redis({
        host: options.redis.host ?? 'localhost',
        port: options.redis.port ?? 6379,
        password: options.redis.password,
      });
      contextStore = new RedisConversationContextStore({
        client,
        ttlSeconds: options.redis.ttlSeconds,
      });
    } else {
      contextStore = new MemoryConversationContextStore();
    }

    const providers: unknown[] = [
      {
        provide: MessagingService,
        useFactory: () =>
          new MessagingService(
            {
              aiProvider: options.aiProvider,
              systemPrompt: options.systemPrompt,
              model: options.model,
              temperature: options.temperature,
              maxTokens: options.maxTokens,
              maxContextTurns: options.maxContextTurns,
              customHandler: options.customHandler,
              agentHandler: options.agentHandler,
              ragService: options.ragService,
              ragTopK: options.ragTopK,
              ragMinScore: options.ragMinScore,
            },
            contextStore
          ),
      },
      { provide: MESSAGING_ADAPTERS, useValue: adapters },
      { provide: MESSAGING_USE_KAFKA, useValue: useKafka },
      ...(useKafka
        ? [
            {
              provide: MESSAGING_KAFKA_PRODUCER,
              // eslint-disable-next-line @typescript-eslint/no-require-imports -- @hazeljs/kafka is optional
              useExisting: require('@hazeljs/kafka').KafkaProducerService,
            },
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load when Kafka enabled
            require('./messaging-kafka.consumer').MessagingKafkaConsumer,
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load when Kafka enabled
            require('./messaging-kafka.bootstrap').MessagingKafkaBootstrap,
          ]
        : [{ provide: MESSAGING_KAFKA_PRODUCER, useValue: null }]),
    ];

    if (useKafka) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- @hazeljs/kafka is optional
      const { KafkaModule } = require('@hazeljs/kafka');
      KafkaModule.forRoot({
        clientId: 'messaging',
        brokers: options.kafka?.brokers ?? ['localhost:9092'],
        ...options.kafka,
      });
      imports.push(KafkaModule);
    }

    return {
      module: MessagingModule,
      imports: imports.length > 0 ? imports : undefined,
      providers,
      controllers: [MessagingController],
    };
  }

  static getOptions(): MessagingModuleOptions {
    return MessagingModule.options;
  }
}
