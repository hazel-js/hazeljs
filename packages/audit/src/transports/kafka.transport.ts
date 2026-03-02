/**
 * Kafka audit transport — sends each audit event to a Kafka topic.
 * Use with @hazeljs/kafka: pass KafkaProducerService as the sender.
 * Supports JSON (default) or custom serialization (e.g. Avro via a serialize function).
 */

import type { AuditEvent, AuditTransport } from '../audit.types';

/**
 * Minimal sender interface so this package does not depend on @hazeljs/kafka.
 * KafkaProducerService from @hazeljs/kafka implements this.
 * Value can be string (JSON) or Buffer (e.g. Avro-encoded).
 */
export interface KafkaAuditSender {
  send(
    topic: string,
    messages:
      | { key?: string; value: string | Buffer }
      | Array<{ key?: string; value: string | Buffer }>
  ): Promise<void>;
}

/**
 * Serialize an audit event for Kafka. Return string (JSON) or Buffer (e.g. Avro).
 * For Avro: use `avsc` or Confluent Schema Registry and return the encoded Buffer.
 */
export type KafkaAuditSerializer = (
  event: AuditEvent
) => string | Buffer | Promise<string | Buffer>;

export interface KafkaAuditTransportOptions {
  /** Sender that can send messages to Kafka (e.g. KafkaProducerService from @hazeljs/kafka) */
  sender: KafkaAuditSender;
  /** Topic to publish audit events to */
  topic: string;
  /** Optional key for partitioning (e.g. by actor id or resource) */
  key?: (event: AuditEvent) => string | undefined;
  /**
   * Serialize event before sending. Default: JSON.stringify.
   * For Avro: pass a function that encodes the event to Buffer (e.g. using avsc or @kafkajs/confluent-schema-registry).
   */
  serialize?: KafkaAuditSerializer;
}

function defaultSerialize(event: AuditEvent): string {
  return JSON.stringify(event);
}

export class KafkaAuditTransport implements AuditTransport {
  private readonly sender: KafkaAuditSender;
  private readonly topic: string;
  private readonly keyFn: ((event: AuditEvent) => string | undefined) | undefined;
  private readonly serialize: KafkaAuditSerializer;

  constructor(options: KafkaAuditTransportOptions) {
    this.sender = options.sender;
    this.topic = options.topic;
    this.keyFn = options.key;
    this.serialize = options.serialize ?? defaultSerialize;
  }

  async log(event: AuditEvent): Promise<void> {
    const value = await Promise.resolve(this.serialize(event));
    const key = this.keyFn?.(event);
    return this.sender.send(this.topic, key != null ? { key, value } : { value });
  }
}
