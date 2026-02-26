/**
 * Kafka messaging types - shared between producer and consumer
 */
import type { IncomingMessage } from './types/message.types';

export const MESSAGING_INCOMING_TOPIC = 'messaging.incoming';

export interface MessagingIncomingPayload {
  message: IncomingMessage;
  channel: string;
}
