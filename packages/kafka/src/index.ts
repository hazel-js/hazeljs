/**
 * @hazeljs/kafka - Kafka module for HazelJS
 */

export { KafkaModule } from './kafka.module';
export { KafkaProducerService } from './kafka-producer.service';
export { KafkaConsumerService } from './kafka-consumer.service';
export { KafkaStreamProcessor } from './kafka-stream.processor';
export { KAFKA_CLIENT_TOKEN } from './kafka-producer.service';
export {
  KafkaConsumer,
  getKafkaConsumerMetadata,
  isKafkaConsumer,
} from './decorators/kafka-consumer.decorator';
export {
  KafkaSubscribe,
  getKafkaSubscribeMetadata,
  type KafkaSubscribeMetadata,
} from './decorators/kafka-subscribe.decorator';
export type {
  KafkaModuleOptions,
  KafkaClientOptions,
  KafkaConsumerOptions,
  KafkaSubscribeOptions,
  KafkaProduceOptions,
  KafkaMessage,
  KafkaMessagePayload,
  KafkaMessageHandler,
  KafkaStreamTransform,
  KafkaSaslOptions,
  KafkaSslOptions,
  SaslMechanism,
} from './kafka.types';
