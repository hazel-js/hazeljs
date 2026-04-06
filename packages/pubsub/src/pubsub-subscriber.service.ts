import { Inject, Service } from '@hazeljs/core';
import type { Message, PubSub, Subscription } from '@google-cloud/pubsub';
import { getPubSubConsumerMetadata } from './decorators/pubsub-consumer.decorator';
import { getPubSubSubscribeMetadata } from './decorators/pubsub-subscribe.decorator';
import {
  PubSubHandlerResult,
  PubSubSubscriptionHandlerPayload,
  PubSubSubscribeMetadata,
  PubSubSubscribeOptions,
} from './pubsub.types';
import logger from '@hazeljs/core';
import { PUBSUB_CLIENT_TOKEN } from './pubsub-publisher.service';

interface RunningSubscription {
  provider: object;
  subscriptionName: string;
  subscription: Subscription;
  handler: (message: Message) => Promise<void>;
}

@Service()
export class PubSubSubscriberService {
  private runningSubscriptions: RunningSubscription[] = [];

  constructor(
    @Inject(PUBSUB_CLIENT_TOKEN)
    private readonly pubsub: PubSub
  ) {}

  async registerFromProvider(provider: object): Promise<void> {
    const consumerOptions = getPubSubConsumerMetadata(provider.constructor);
    const subscribeMetadata = getPubSubSubscribeMetadata(provider.constructor);

    if (!consumerOptions) {
      logger.warn(
        `Provider ${provider.constructor.name} has @PubSubSubscribe but no @PubSubConsumer decorator - skipping`
      );
      return;
    }

    if (!subscribeMetadata.length) {
      logger.warn(
        `Provider ${provider.constructor.name} has @PubSubConsumer but no @PubSubSubscribe - skipping`
      );
      return;
    }

    for (const metadata of subscribeMetadata) {
      await this.registerSubscription(provider, metadata, consumerOptions);
    }
  }

  private async registerSubscription(
    provider: object,
    metadata: PubSubSubscribeMetadata,
    consumerDefaults: {
      ackOnSuccess?: boolean;
      nackOnError?: boolean;
      parseJson?: boolean;
      autoCreateSubscription?: boolean;
    }
  ): Promise<void> {
    const method = (
      provider as Record<
        string,
        (
          payload: PubSubSubscriptionHandlerPayload
        ) => Promise<PubSubHandlerResult> | PubSubHandlerResult
      >
    )[metadata.methodName];
    if (typeof method !== 'function') {
      logger.error(`Handler ${metadata.methodName} not found on ${provider.constructor.name}`);
      return;
    }

    const options = this.mergeOptions(consumerDefaults, metadata.options);
    const subscription = await this.resolveSubscription(options);
    const handler = async (message: Message): Promise<void> => {
      await this.handleMessage(provider, method, options, message);
    };

    subscription.on('message', handler);
    subscription.on('error', (error: Error) => {
      logger.error(
        `Pub/Sub subscription error on ${provider.constructor.name}.${metadata.methodName}:`,
        error
      );
    });

    this.runningSubscriptions.push({
      provider,
      subscriptionName: options.subscription,
      subscription,
      handler,
    });

    logger.info(
      `Pub/Sub subscription started for ${provider.constructor.name}.${metadata.methodName} (${options.subscription})`
    );
  }

  private mergeOptions(
    consumerDefaults: {
      ackOnSuccess?: boolean;
      nackOnError?: boolean;
      parseJson?: boolean;
      autoCreateSubscription?: boolean;
    },
    methodOptions: PubSubSubscribeOptions
  ): Required<Pick<PubSubSubscribeOptions, 'subscription'>> & PubSubSubscribeOptions {
    return {
      ...methodOptions,
      parseJson: methodOptions.parseJson ?? consumerDefaults.parseJson ?? true,
      ackOnSuccess: methodOptions.ackOnSuccess ?? consumerDefaults.ackOnSuccess ?? true,
      nackOnError: methodOptions.nackOnError ?? consumerDefaults.nackOnError ?? true,
      autoCreateSubscription:
        methodOptions.autoCreateSubscription ?? consumerDefaults.autoCreateSubscription ?? false,
    };
  }

  private async resolveSubscription(options: PubSubSubscribeOptions): Promise<Subscription> {
    const subscription = this.pubsub.subscription(options.subscription);

    if (!options.autoCreateSubscription) {
      return subscription;
    }

    const [exists] = await subscription.exists();
    if (exists) return subscription;

    if (!options.topic) {
      throw new Error(
        `Cannot auto-create subscription "${options.subscription}" without a topic. Add topic to @PubSubSubscribe options.`
      );
    }

    const topic = this.pubsub.topic(options.topic);
    await topic.createSubscription(options.subscription);
    logger.info(
      `Auto-created Pub/Sub subscription "${options.subscription}" for topic "${options.topic}"`
    );
    return this.pubsub.subscription(options.subscription);
  }

  private async handleMessage(
    provider: object,
    method: (
      payload: PubSubSubscriptionHandlerPayload
    ) => Promise<PubSubHandlerResult> | PubSubHandlerResult,
    options: PubSubSubscribeOptions,
    message: Message
  ): Promise<void> {
    const rawData = message.data;
    const parsed = this.parseData(rawData, options.parseJson ?? true);
    const payload: PubSubSubscriptionHandlerPayload = {
      data: parsed,
      rawData,
      attributes: message.attributes ?? {},
      id: message.id,
      orderingKey: message.orderingKey,
      publishTime: message.publishTime ? new Date(message.publishTime) : undefined,
      ack: () => message.ack(),
      nack: () => message.nack(),
    };

    try {
      const result = await method.call(provider, payload);
      if (result === 'nack') {
        message.nack();
        return;
      }
      if (result === 'ack' || options.ackOnSuccess) {
        message.ack();
      }
    } catch (error) {
      logger.error(
        `Error in Pub/Sub handler ${provider.constructor.name}.${method.name || 'anonymous'}:`,
        error
      );
      if (options.nackOnError) {
        message.nack();
      }
    }
  }

  private parseData(data: Buffer, parseJson: boolean): unknown {
    const content = data.toString();
    if (!parseJson) return content;
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const item of this.runningSubscriptions) {
      try {
        item.subscription.removeListener('message', item.handler);
      } catch (error) {
        logger.error(
          `Failed removing Pub/Sub listener (${item.provider.constructor.name}, ${item.subscriptionName}):`,
          error
        );
      }
    }
    this.runningSubscriptions = [];
  }

  getSubscriptionCount(): number {
    return this.runningSubscriptions.length;
  }
}
