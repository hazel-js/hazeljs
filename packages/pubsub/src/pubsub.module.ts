import { Container, HazelModule } from '@hazeljs/core';
import { PubSub } from '@google-cloud/pubsub';
import { PubSubModuleOptions } from './pubsub.types';
import { PubSubPublisherService, PUBSUB_CLIENT_TOKEN } from './pubsub-publisher.service';
import { PubSubSubscriberService } from './pubsub-subscriber.service';
import logger from '@hazeljs/core';

@HazelModule({
  providers: [PubSubPublisherService, PubSubSubscriberService],
  exports: [PubSubPublisherService, PubSubSubscriberService],
})
export class PubSubModule {
  static forRoot(options: PubSubModuleOptions = {}): typeof PubSubModule {
    logger.info('Configuring Pub/Sub module...');

    const pubsubClient = new PubSub({
      projectId: options.projectId,
      keyFilename: options.keyFilename,
      apiEndpoint: options.apiEndpoint,
    });

    Container.getInstance().register(PUBSUB_CLIENT_TOKEN, pubsubClient);
    return PubSubModule;
  }

  static async forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<PubSubModuleOptions> | PubSubModuleOptions;
    inject?: unknown[];
  }): Promise<typeof PubSubModule> {
    const container = Container.getInstance();
    const injectTokens = options.inject ?? [];
    const deps = injectTokens.map((token) =>
      container.resolve(token as Parameters<Container['resolve']>[0])
    );
    const pubsubOptions = await Promise.resolve(options.useFactory(...deps));

    const pubsubClient = new PubSub({
      projectId: pubsubOptions.projectId,
      keyFilename: pubsubOptions.keyFilename,
      apiEndpoint: pubsubOptions.apiEndpoint,
    });

    container.register(PUBSUB_CLIENT_TOKEN, pubsubClient);
    return PubSubModule;
  }

  static async registerSubscriptionsFromProvider(provider: object): Promise<void> {
    try {
      const container = Container.getInstance();
      const subscriberService = container.resolve(PubSubSubscriberService);

      if (!subscriberService) {
        logger.warn('PubSubSubscriberService not found in DI container');
        return;
      }

      await subscriberService.registerFromProvider(provider);
      logger.info(`Registered Pub/Sub subscriptions from provider: ${provider.constructor.name}`);
    } catch (error) {
      logger.error('Error registering Pub/Sub subscriptions from provider:', error);
    }
  }
}
