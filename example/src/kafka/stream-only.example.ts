/**
 * Kafka Streams - Standalone Example
 *
 * Runs only the stream pipelines without the HTTP server.
 * Useful for stream-processing-only deployments or testing pipelines in isolation.
 *
 * Run: npm run kafka:streams
 * Requires: Kafka broker (docker compose -f src/kafka/docker-compose.yml up -d)
 */

import { HazelApp, Container } from '@hazeljs/core';
import { KafkaExampleModule } from './kafka-example.module';
import { StreamPipelinesService } from './stream-pipelines.service';
import { ensureTopics } from './ensure-topics';
import logger from '@hazeljs/core';

async function bootstrap() {
  const app = new HazelApp(KafkaExampleModule);

  const container = Container.getInstance();
  await ensureTopics();

  const streamPipelines = container.resolve(StreamPipelinesService);

  if (!streamPipelines) {
    throw new Error('StreamPipelinesService not found');
  }

  await streamPipelines.startAllPipelines();

  logger.info(`
Kafka Streams running (standalone mode - no HTTP server)

Pipelines:
  1. Enrichment:  orders -> enriched-orders
  2. Filter:      enriched-orders -> high-value-orders (total >= 100)
  3. Transform:   order-events -> normalized-order-events

Produce messages using the full example (npm run kafka) or kafka-console-producer.
Press Ctrl+C to stop.
  `);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down stream pipelines...');
    await streamPipelines.stopAllPipelines();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down stream pipelines...');
    await streamPipelines.stopAllPipelines();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start Kafka streams:', error);
  process.exit(1);
});
