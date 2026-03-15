/**
 * Kafka inspector plugin - inspects @KafkaConsumer and @KafkaSubscribe
 * Optional: requires @hazeljs/kafka to be installed
 */

import 'reflect-metadata';
import type { InspectorEntry, KafkaInspectorEntry, HazelInspectorPlugin } from '../contracts/types';

function createId(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

function tryGetKafkaModule(): {
  isKafkaConsumer: (t: object) => boolean;
  getKafkaConsumerMetadata: (t: object) => { groupId?: string } | undefined;
  getKafkaSubscribeMetadata: (t: object) => Array<{ topic: string; methodName: string }>;
} | null {
  try {
    return require('@hazeljs/kafka');
  } catch {
    return null;
  }
}

export const kafkaInspector: HazelInspectorPlugin = {
  name: 'kafka',
  version: '1.0.0',
  supports: () => tryGetKafkaModule() !== null,
  inspect: async (context): Promise<InspectorEntry[]> => {
    const kafkaMod = tryGetKafkaModule();
    if (!kafkaMod) return [];

    const entries: KafkaInspectorEntry[] = [];
    const tokens = (context.container as { getTokens?: () => unknown[] }).getTokens?.() ?? [];

    for (const token of tokens) {
      if (typeof token !== 'function') continue;
      const ctor = token as new (...args: unknown[]) => object;
      if (!kafkaMod.isKafkaConsumer(ctor)) continue;

      const consumerMeta = kafkaMod.getKafkaConsumerMetadata(ctor);
      // getKafkaSubscribeMetadata expects target.constructor to be the class; pass prototype
      const target = ctor.prototype ?? ctor;
      const subs = kafkaMod.getKafkaSubscribeMetadata(target);
      if (!subs?.length) continue;

      const className = (token as { name?: string }).name ?? 'Unknown';
      for (const s of subs) {
        entries.push({
          id: createId('kafka', className, s.topic, s.methodName),
          kind: 'kafka',
          packageName: '@hazeljs/kafka',
          sourceType: 'method',
          className,
          methodName: s.methodName,
          consumerName: className,
          groupId: consumerMeta?.groupId,
          topic: s.topic,
        });
      }
    }

    return entries;
  },
};
