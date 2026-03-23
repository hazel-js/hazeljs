/**
 * Online Feature Store - Low-latency feature retrieval for inference
 */

import type { FeatureValue, OnlineStoreConfig } from './feature.types';

export interface OnlineStore {
  get(entityId: string, featureName: string): Promise<FeatureValue | null>;
  getMulti(entityId: string, featureNames: string[]): Promise<Record<string, unknown>>;
  set(value: FeatureValue): Promise<void>;
  setMulti(values: FeatureValue[]): Promise<void>;
  delete(entityId: string, featureName: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * In-memory online store - for development and testing
 */
export class MemoryOnlineStore implements OnlineStore {
  private store: Map<string, FeatureValue> = new Map();

  private getKey(entityId: string, featureName: string): string {
    return `${entityId}:${featureName}`;
  }

  async get(entityId: string, featureName: string): Promise<FeatureValue | null> {
    return this.store.get(this.getKey(entityId, featureName)) ?? null;
  }

  async getMulti(entityId: string, featureNames: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const name of featureNames) {
      const value = await this.get(entityId, name);
      if (value) {
        result[name] = value.value;
      }
    }
    return result;
  }

  async set(value: FeatureValue): Promise<void> {
    this.store.set(this.getKey(value.entityId, value.featureName), value);
  }

  async setMulti(values: FeatureValue[]): Promise<void> {
    for (const value of values) {
      await this.set(value);
    }
  }

  async delete(entityId: string, featureName: string): Promise<void> {
    this.store.delete(this.getKey(entityId, featureName));
  }

  async close(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Redis online store - for production use
 * Requires 'redis' as peer dependency
 */
export class RedisOnlineStore implements OnlineStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private config: NonNullable<OnlineStoreConfig['redis']>;

  constructor(config: NonNullable<OnlineStoreConfig['redis']>) {
    this.config = config;
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const redis = require('redis');
      this.client = redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.db ?? 0,
      });
      await this.client.connect();
    } catch (error) {
      throw new Error(
        `RedisOnlineStore requires 'redis' package. Install with: npm install redis\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getKey(entityId: string, featureName: string): string {
    return `hazel:feature:${entityId}:${featureName}`;
  }

  async get(entityId: string, featureName: string): Promise<FeatureValue | null> {
    await this.ensureClient();
    const key = this.getKey(entityId, featureName);
    const data = await this.client.get(key);
    if (!data) return null;
    return JSON.parse(data) as FeatureValue;
  }

  async getMulti(entityId: string, featureNames: string[]): Promise<Record<string, unknown>> {
    await this.ensureClient();
    const keys = featureNames.map((name) => this.getKey(entityId, name));
    const values = await this.client.mGet(keys);
    const result: Record<string, unknown> = {};

    for (let i = 0; i < featureNames.length; i++) {
      if (values[i]) {
        const parsed = JSON.parse(values[i]) as FeatureValue;
        result[featureNames[i]] = parsed.value;
      }
    }
    return result;
  }

  async set(value: FeatureValue): Promise<void> {
    await this.ensureClient();
    const key = this.getKey(value.entityId, value.featureName);
    await this.client.set(key, JSON.stringify(value));
  }

  async setMulti(values: FeatureValue[]): Promise<void> {
    await this.ensureClient();
    const pipeline = this.client.multi();
    for (const value of values) {
      const key = this.getKey(value.entityId, value.featureName);
      pipeline.set(key, JSON.stringify(value));
    }
    await pipeline.exec();
  }

  async delete(entityId: string, featureName: string): Promise<void> {
    await this.ensureClient();
    const key = this.getKey(entityId, featureName);
    await this.client.del(key);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export function createOnlineStore(config: OnlineStoreConfig): OnlineStore {
  if (config.type === 'redis') {
    if (!config.redis) {
      throw new Error('Redis configuration is required for redis online store');
    }
    return new RedisOnlineStore(config.redis);
  }
  return new MemoryOnlineStore();
}
