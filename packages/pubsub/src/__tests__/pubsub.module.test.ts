import { Container } from '@hazeljs/core';
import { PubSubModule } from '../pubsub.module';
import { PUBSUB_CLIENT_TOKEN } from '../pubsub-publisher.service';

describe('PubSubModule', () => {
  describe('forRoot', () => {
    it('returns PubSubModule and registers client', () => {
      const result = PubSubModule.forRoot({
        projectId: 'test-project',
      });

      expect(result).toBe(PubSubModule);
      const container = Container.getInstance();
      const client = container.resolve(PUBSUB_CLIENT_TOKEN) as { topic: (name: string) => unknown };
      expect(client).toBeDefined();
      expect(client?.topic).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('returns PubSubModule and registers client', async () => {
      const result = await PubSubModule.forRootAsync({
        useFactory: () =>
          Promise.resolve({
            projectId: 'async-project',
          }),
        inject: [],
      });

      expect(result).toBe(PubSubModule);
      const container = Container.getInstance();
      const client = container.resolve(PUBSUB_CLIENT_TOKEN);
      expect(client).toBeDefined();
    });
  });
});
