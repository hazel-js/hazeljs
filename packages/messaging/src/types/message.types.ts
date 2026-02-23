/**
 * @hazeljs/messaging - Core message types
 * Channel-agnostic normalized format for multichannel bots
 */

/** Supported messaging channels */
export type MessagingChannel = 'telegram' | 'whatsapp' | 'viber' | 'slack' | 'teams' | 'custom';

/** Normalized incoming message - same structure regardless of channel */
export interface IncomingMessage {
  /** Unique message ID */
  id: string;
  /** Channel source */
  channel: MessagingChannel;
  /** Channel-specific conversation/chat ID */
  conversationId: string;
  /** User/sender identifier (channel-specific) */
  userId: string;
  /** Display name when available */
  userName?: string;
  /** Message text content */
  text: string;
  /** Raw payload from channel (for advanced use) */
  rawPayload?: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Session/thread identifier for context */
  sessionId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Normalized outgoing message */
export interface OutgoingMessage {
  /** Target conversation ID */
  conversationId: string;
  /** Response text */
  text: string;
  /** Optional reply to specific message */
  replyToMessageId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Channel adapter - receives raw webhook, produces IncomingMessage; sends OutgoingMessage */
export interface IChannelAdapter {
  readonly channel: MessagingChannel;
  /** Parse webhook payload into IncomingMessage */
  parseIncoming(payload: unknown): IncomingMessage | IncomingMessage[] | null;
  /** Send response to the channel */
  send(message: OutgoingMessage): Promise<void>;
  /** Optional: verify webhook (e.g. signature validation) */
  verifyWebhook?(payload: unknown, headers?: Record<string, string>): boolean;
}

/** Handler for incoming messages - receives normalized message, returns response text */
export type MessageHandler = (message: IncomingMessage) => Promise<string> | string;

/** LLM response mode */
export type ResponseMode = 'llm' | 'agent' | 'custom';
