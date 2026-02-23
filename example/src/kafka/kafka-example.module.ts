import { HazelModule } from '@hazeljs/core';
import { KafkaModule } from '@hazeljs/kafka';
import { OrderConsumer } from './order.consumer';
import { OrderService } from './order.service';
import { KafkaExampleController } from './kafka-example.controller';
import { StreamPipelinesService } from './stream-pipelines.service';
import { StreamOutputConsumer } from './stream-output.consumer';

/**
 * Kafka example module - produce, consume, and stream processing
 */
@HazelModule({
  imports: [
    KafkaModule.forRoot({
      clientId: 'kafka-example',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    }),
  ],
  controllers: [KafkaExampleController],
  providers: [OrderConsumer, OrderService, StreamPipelinesService, StreamOutputConsumer],
})
export class KafkaExampleModule {}
