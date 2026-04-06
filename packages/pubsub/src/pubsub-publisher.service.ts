import { Inject, Service } from '@hazeljs/core';
import { PubSub } from '@google-cloud/pubsub';
import { PubSubPublishOptions } from './pubsub.types';
import logger from '@hazeljs/core';

export const PUBSUB_CLIENT_TOKEN = 'PUBSUB_CLIENT';

@Service()
export class PubSubPublisherService {
  constructor(
    @Inject(PUBSUB_CLIENT_TOKEN)
    private readonly pubsub: PubSub
  ) {}

  async publish(
    topicName: string,
    data: string | Buffer | object,
    options: PubSubPublishOptions = {}
  ): Promise<string> {
    const topic = this.pubsub.topic(topicName);
    const payload = this.toBuffer(data);
    const messageId = await topic.publishMessage({
      data: payload,
      attributes: options.attributes,
      orderingKey: options.orderingKey,
    });
    logger.debug(`Published Pub/Sub message to topic "${topicName}" (id: ${messageId})`);
    return messageId;
  }

  async publishJson<T extends object>(
    topicName: string,
    data: T,
    options: Omit<PubSubPublishOptions, 'attributes'> & { attributes?: Record<string, string> } = {}
  ): Promise<string> {
    return this.publish(topicName, data, {
      ...options,
      attributes: {
        'content-type': 'application/json',
        ...(options.attributes ?? {}),
      },
    });
  }

  private toBuffer(data: string | Buffer | object): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') return Buffer.from(data);
    return Buffer.from(JSON.stringify(data));
  }
}
