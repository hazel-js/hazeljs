/**
 * Pub/Sub module types and interfaces
 */

export interface PubSubClientOptions {
  projectId?: string;
  keyFilename?: string;
  apiEndpoint?: string;
}

export interface PubSubModuleOptions extends PubSubClientOptions {
  /**
   * Whether this is a global module.
   * @default true
   */
  isGlobal?: boolean;
}

export interface PubSubPublishOptions {
  attributes?: Record<string, string>;
  orderingKey?: string;
}

export interface PubSubSubscribeOptions {
  subscription: string;
  topic?: string;
  autoCreateSubscription?: boolean;
  ackOnSuccess?: boolean;
  nackOnError?: boolean;
  parseJson?: boolean;
}

export interface PubSubConsumerOptions {
  ackOnSuccess?: boolean;
  nackOnError?: boolean;
  parseJson?: boolean;
  autoCreateSubscription?: boolean;
}

export interface PubSubSubscribeMetadata {
  methodName: string;
  options: PubSubSubscribeOptions;
}

export interface PubSubSubscriptionHandlerPayload<T = unknown> {
  data: T;
  rawData: Buffer;
  attributes: Record<string, string>;
  id: string;
  orderingKey?: string;
  publishTime?: Date;
  ack: () => void;
  nack: () => void;
}

export type PubSubHandlerResult = void | 'ack' | 'nack';
