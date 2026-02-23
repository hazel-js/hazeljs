import { KafkaModule } from '../kafka.module';
import { Container } from '@hazeljs/core';
import { KAFKA_CLIENT_TOKEN } from '../kafka-producer.service';

describe('KafkaModule', () => {
  describe('forRoot', () => {
    it('should return KafkaModule and register client', () => {
      const result = KafkaModule.forRoot({
        clientId: 'test-app',
        brokers: ['localhost:9092'],
      });

      expect(result).toBe(KafkaModule);
      const container = Container.getInstance();
      const client = container.resolve(KAFKA_CLIENT_TOKEN) as { producer: () => unknown };
      expect(client).toBeDefined();
      expect(client?.producer).toBeDefined();
    });

    it('should use default options', () => {
      KafkaModule.forRoot({});
      const container = Container.getInstance();
      const client = container.resolve(KAFKA_CLIENT_TOKEN);
      expect(client).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('should return KafkaModule and register client', async () => {
      const result = await KafkaModule.forRootAsync({
        useFactory: () =>
          Promise.resolve({
            clientId: 'async-app',
            brokers: ['kafka:9092'],
          }),
        inject: [],
      });

      expect(result).toBe(KafkaModule);
      const container = Container.getInstance();
      const client = container.resolve(KAFKA_CLIENT_TOKEN);
      expect(client).toBeDefined();
    });
  });
});
