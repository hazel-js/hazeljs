/**
 * Kafka consumer for async message processing - horizontally scalable
 */
import { Injectable, Inject } from '@hazeljs/core';
import { KafkaConsumer, KafkaSubscribe } from '@hazeljs/kafka';
import { KafkaMessagePayload } from '@hazeljs/kafka';
import { MessagingService } from './messaging.service';
import type { IChannelAdapter } from './types/message.types';
import logger from '@hazeljs/core';
import { MESSAGING_ADAPTERS } from './messaging.controller';
import { MESSAGING_INCOMING_TOPIC, type MessagingIncomingPayload } from './messaging-kafka.types';

@Injectable()
@KafkaConsumer({ groupId: 'messaging-bot' })
export class MessagingKafkaConsumer {
  constructor(
    private readonly messagingService: MessagingService,
    @Inject(MESSAGING_ADAPTERS) private readonly adapters: IChannelAdapter[]
  ) {}

  @KafkaSubscribe(MESSAGING_INCOMING_TOPIC)
  async handleIncoming(payload: KafkaMessagePayload): Promise<void> {
    const raw = payload.message.value?.toString();
    if (!raw) return;

    let data: MessagingIncomingPayload;
    try {
      data = JSON.parse(raw) as MessagingIncomingPayload;
    } catch {
      logger.error('MessagingKafkaConsumer: invalid JSON payload');
      return;
    }

    const { message, channel } = data;
    const adapter = this.adapters.find((a) => a.channel === channel);
    if (!adapter) {
      logger.warn(`MessagingKafkaConsumer: no adapter for channel ${channel}`);
      return;
    }

    try {
      const response = await this.messagingService.handleMessage(message);
      if (response) {
        await adapter.send({
          conversationId: message.conversationId,
          text: response,
          replyToMessageId: message.id,
        });
      }
    } catch (err) {
      logger.error(`MessagingKafkaConsumer error for ${channel}:`, err);
      throw err; // Let Kafka retry
    }
  }
}
