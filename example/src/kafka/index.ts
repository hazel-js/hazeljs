/**
 * Kafka Example
 *
 * Demonstrates produce, consume, and stream processing with @hazeljs/kafka.
 * Requires a running Kafka broker (docker compose -f src/kafka/docker-compose.yml up -d).
 */

import { HazelApp, Container } from '@hazeljs/core';
import { KafkaModule } from '@hazeljs/kafka';
import { KafkaExampleModule } from './kafka-example.module';
import { OrderConsumer } from './order.consumer';
import { StreamOutputConsumer } from './stream-output.consumer';
import { StreamPipelinesService } from './stream-pipelines.service';
import { ensureTopics } from './ensure-topics';
import logger from '@hazeljs/core';

async function bootstrap() {
  const app = new HazelApp(KafkaExampleModule);

  const container = Container.getInstance();

  // Create topics before consumers start (avoids UNKNOWN_TOPIC_OR_PARTITION)
  await ensureTopics();

  // Register Kafka consumers from providers
  const orderConsumer = container.resolve(OrderConsumer);
  if (orderConsumer) {
    await KafkaModule.registerConsumersFromProvider(orderConsumer);
    logger.info('Order consumer registered');
  }

  const streamOutputConsumer = container.resolve(StreamOutputConsumer);
  if (streamOutputConsumer) {
    await KafkaModule.registerConsumersFromProvider(streamOutputConsumer);
    logger.info('Stream output consumer registered');
  }

  // Start Kafka stream pipelines
  const streamPipelines = container.resolve(StreamPipelinesService);
  if (streamPipelines) {
    await streamPipelines.startAllPipelines();
    logger.info('Stream pipelines started');
  }

  const port = parseInt(process.env.PORT || '3010');
  await app.listen(port);

  logger.info(`
Kafka Example running on http://localhost:${port}

Endpoints:
  POST /kafka/orders/     - Create order (produces to 'orders')
  POST /kafka/orders/events - Publish order event (produces to 'order-events')

Stream pipelines (automatic):
  orders -> enrichment -> enriched-orders
  enriched-orders -> filter (total>=100) -> high-value-orders
  order-events -> transform -> normalized-order-events

Requires Kafka at KAFKA_BROKERS (default: localhost:9092)
  `);
}

bootstrap().catch((error) => {
  logger.error('Failed to start Kafka example:', error);
  process.exit(1);
});
