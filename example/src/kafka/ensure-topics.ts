/**
 * Ensures required Kafka topics exist before consumers/streams start.
 * Prevents UNKNOWN_TOPIC_OR_PARTITION when topics are auto-disabled or not yet created.
 */

import { Container } from '@hazeljs/core';
import { KAFKA_CLIENT_TOKEN } from '@hazeljs/kafka';
import type { Kafka } from 'kafkajs';
import logger from '@hazeljs/core';

export const REQUIRED_TOPICS = [
  'orders',
  'order-events',
  'enriched-orders',
  'high-value-orders',
  'normalized-order-events',
];

export async function ensureTopics(): Promise<void> {
  const container = Container.getInstance();
  const kafka = container.resolve(KAFKA_CLIENT_TOKEN) as Kafka;
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: REQUIRED_TOPICS.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      })),
      waitForLeaders: true,
      timeout: 10000,
    });
    logger.info(`Ensured Kafka topics exist: ${REQUIRED_TOPICS.join(', ')}`);
  } finally {
    await admin.disconnect();
  }
}
