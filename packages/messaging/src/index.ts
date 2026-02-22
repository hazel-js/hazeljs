/**
 * @hazeljs/messaging
 * Multichannel messaging - WhatsApp, Telegram, Viber with LLM-powered bot responses
 */

export { MessagingModule } from './messaging.module';
export type { MessagingModuleOptions, MessagingModuleChannelConfig } from './messaging.module';
export { MessagingService } from './messaging.service';
export type { MessagingServiceOptions } from './messaging.service';
export type {
  AgentHandler,
  AgentHandlerInput,
  AgentHandlerResult,
  IRAGSearch,
} from './types/response-handler.types';
export { MessagingController, MESSAGING_ADAPTERS } from './messaging.controller';

export { TelegramAdapter } from './adapters/telegram.adapter';
export type { TelegramAdapterConfig } from './adapters/telegram.adapter';
export { WhatsAppAdapter } from './adapters/whatsapp.adapter';
export type { WhatsAppAdapterConfig } from './adapters/whatsapp.adapter';
export { ViberAdapter } from './adapters/viber.adapter';
export type { ViberAdapterConfig } from './adapters/viber.adapter';
export { SlackAdapter } from './adapters/slack.adapter';
export type { SlackAdapterConfig } from './adapters/slack.adapter';
export { TeamsAdapter } from './adapters/teams.adapter';
export type { TeamsAdapterConfig } from './adapters/teams.adapter';

export type {
  MessagingChannel,
  IncomingMessage,
  OutgoingMessage,
  IChannelAdapter,
  MessageHandler,
  ResponseMode,
} from './types/message.types';

export { MemoryConversationContextStore } from './store/memory-conversation-context';
export { RedisConversationContextStore } from './store/redis-conversation-context';
export type {
  IConversationContextStore,
  ConversationTurn,
} from './store/conversation-context.interface';
export type { RedisConversationContextConfig } from './store/redis-conversation-context';
export { MESSAGING_INCOMING_TOPIC } from './messaging-kafka.types';
export type { MessagingIncomingPayload } from './messaging-kafka.types';
