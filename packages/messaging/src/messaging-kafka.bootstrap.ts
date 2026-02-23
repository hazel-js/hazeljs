/**
 * Registers MessagingKafkaConsumer with KafkaConsumerService on module init
 */
import { Injectable, Inject, type OnModuleInit } from '@hazeljs/core';
import { KafkaConsumerService } from '@hazeljs/kafka';
import { MessagingKafkaConsumer } from './messaging-kafka.consumer';
import { MESSAGING_USE_KAFKA } from './messaging.controller';

@Injectable()
export class MessagingKafkaBootstrap implements OnModuleInit {
  constructor(
    private readonly consumerService: KafkaConsumerService,
    private readonly messagingConsumer: MessagingKafkaConsumer,
    @Inject(MESSAGING_USE_KAFKA) private readonly useKafka: boolean
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.useKafka) return;
    await this.consumerService.registerFromProvider(this.messagingConsumer);
  }
}
