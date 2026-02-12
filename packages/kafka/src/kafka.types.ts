/**
 * Kafka module types and interfaces
 */

/**
 * SASL authentication mechanism
 */
export type SaslMechanism = 'plain' | 'scram-sha-256' | 'scram-sha-512';

/**
 * SASL configuration for Kafka authentication
 */
export interface KafkaSaslOptions {
  mechanism: SaslMechanism;
  username: string;
  password: string;
}

/**
 * SSL configuration for Kafka
 */
export interface KafkaSslOptions {
  rejectUnauthorized?: boolean;
  ca?: string[];
  cert?: string;
  key?: string;
}

/**
 * Base Kafka client options (KafkaJS compatible)
 */
export interface KafkaClientOptions {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    maxRetryTime?: number;
  };
  ssl?: boolean | KafkaSslOptions;
  sasl?: KafkaSaslOptions;
}

/**
 * Kafka module options for forRoot()
 */
export interface KafkaModuleOptions extends KafkaClientOptions {
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Enable Kafka Stream Processor
   * @default true
   */
  enableStreamProcessor?: boolean;
}

/**
 * Consumer group options (KafkaJS consumer config)
 */
export interface KafkaConsumerOptions {
  groupId: string;
  sessionTimeout?: number;
  rebalanceTimeout?: number;
  heartbeatInterval?: number;
  maxWaitTimeInMs?: number;
  retry?: {
    retries?: number;
    initialRetryTime?: number;
    maxRetryTime?: number;
  };
}

/**
 * Topic subscription options
 */
export interface KafkaSubscribeOptions {
  /**
   * Read from beginning of topic
   * @default false
   */
  fromBeginning?: boolean;
}

/**
 * Producer send options
 */
export interface KafkaProduceOptions {
  acks?: -1 | 0 | 1;
  timeout?: number;
  compression?: 0 | 1 | 2 | 3;
}

/**
 * Kafka message for producing
 */
export interface KafkaMessage {
  key?: string | Buffer;
  value: string | Buffer | null;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

/**
 * Payload passed to eachMessage handler (matches KafkaJS EachMessagePayload)
 */
export interface KafkaMessagePayload {
  topic: string;
  partition: number;
  message: {
    key: Buffer | null;
    value: Buffer | null;
    headers: Record<string, string>;
    offset: string;
    timestamp: string;
    attributes?: number;
  };
  heartbeat(): Promise<void>;
  pause(): void;
  commitOffsets?(
    offsets: Array<{ topic: string; partition: number; offset: string }>
  ): Promise<void>;
}

/**
 * Handler type for Kafka message processing
 */
export type KafkaMessageHandler = (payload: KafkaMessagePayload) => Promise<void>;

/**
 * Transform function for stream processor
 */
export type KafkaStreamTransform<T = unknown, R = unknown> = (message: {
  key: Buffer | null;
  value: Buffer | null;
  headers: Record<string, string>;
}) => Promise<
  | { key?: string | Buffer; value: T | string | Buffer | null; headers?: Record<string, string> }
  | R
  | null
>;
