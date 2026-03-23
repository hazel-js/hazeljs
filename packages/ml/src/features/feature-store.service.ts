/**
 * Feature Store Service - Central registry and retrieval for ML features
 */

import { Service } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type {
  FeatureValue,
  FeatureView,
  FeatureQuery as _FeatureQuery,
  FeatureResponse,
  FeatureStoreConfig,
  FeatureMetadata,
} from './feature.types';
import { createOnlineStore, OnlineStore } from './online-store';
import { createOfflineStore, OfflineStore } from './offline-store';

export interface FeatureRegistration {
  name: string;
  view: FeatureView;
  entityExtractor?: (input: unknown) => string;
}

@Service()
export class FeatureStoreService {
  private features: Map<string, FeatureMetadata> = new Map();
  private views: Map<string, FeatureView> = new Map();
  private onlineStore: OnlineStore | null = null;
  private offlineStore: OfflineStore | null = null;
  private config: FeatureStoreConfig = {};

  configure(config: FeatureStoreConfig): void {
    this.config = config;

    if (config.online) {
      this.onlineStore = createOnlineStore(config.online);
      logger.debug('FeatureStore: online store configured', { type: config.online.type });
    }

    if (config.offline) {
      this.offlineStore = createOfflineStore(config.offline);
      logger.debug('FeatureStore: offline store configured', { type: config.offline.type });
    }
  }

  /**
   * Register a feature view for discovery and retrieval
   */
  registerView(name: string, view: FeatureView): void {
    this.views.set(name, view);

    // Register individual features
    for (const feature of view.features) {
      this.features.set(feature.name, {
        name: feature.name,
        description: feature.description,
        valueType: feature.valueType,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    logger.debug(`Registered feature view: ${name} with ${view.features.length} features`);
  }

  /**
   * Get features for online inference (low-latency)
   */
  async getOnlineFeatures(entityIds: string[], featureNames: string[]): Promise<FeatureResponse[]> {
    if (!this.onlineStore) {
      throw new Error('Online store not configured. Call configure() first.');
    }

    const responses: FeatureResponse[] = [];

    for (const entityId of entityIds) {
      const features = await this.onlineStore.getMulti(entityId, featureNames);
      responses.push({
        entityId,
        features,
        timestamp: new Date(),
      });
    }

    return responses;
  }

  /**
   * Get historical features for training (point-in-time correct)
   */
  async getOfflineFeatures(
    entityIds: string[],
    featureNames: string[],
    timestamp: Date
  ): Promise<FeatureResponse[]> {
    if (!this.offlineStore) {
      throw new Error('Offline store not configured. Call configure() first.');
    }

    if (!this.config.enablePointInTime) {
      // Simple read without point-in-time correction
      const values = await this.offlineStore.read(entityIds, featureNames);
      const grouped = this.groupByEntity(values);

      return entityIds.map((entityId) => ({
        entityId,
        features: grouped[entityId] ?? {},
        timestamp,
      }));
    }

    // Point-in-time correct retrieval (prevents data leakage)
    const pitFeatures = await this.offlineStore.readPointInTime(entityIds, featureNames, timestamp);

    return entityIds.map((entityId) => ({
      entityId,
      features: pitFeatures[entityId] ?? {},
      timestamp,
    }));
  }

  /**
   * Push features to online store (for real-time serving)
   */
  async pushOnlineFeatures(entityId: string, features: Record<string, unknown>): Promise<void> {
    if (!this.onlineStore) {
      throw new Error('Online store not configured');
    }

    const now = new Date();
    const values: FeatureValue[] = Object.entries(features).map(([name, value]) => ({
      entityId,
      featureName: name,
      value,
      timestamp: now,
    }));

    await this.onlineStore.setMulti(values);
  }

  /**
   * Write features to offline store (for training data)
   */
  async writeOfflineFeatures(
    entityId: string,
    features: Record<string, unknown>,
    timestamp: Date = new Date()
  ): Promise<void> {
    if (!this.offlineStore) {
      throw new Error('Offline store not configured');
    }

    const values: FeatureValue[] = Object.entries(features).map(([name, value]) => ({
      entityId,
      featureName: name,
      value,
      timestamp,
    }));

    await this.offlineStore.write(values);
  }

  /**
   * Materialize a feature view - compute and store features
   */
  async materialize(
    viewName: string,
    entityIds: string[],
    options: { toOnline?: boolean; toOffline?: boolean } = {}
  ): Promise<void> {
    const view = this.views.get(viewName);
    if (!view) {
      throw new Error(`Feature view not found: ${viewName}`);
    }

    const _featureNames = view.features.map((f) => f.name);

    for (const entityId of entityIds) {
      const features: Record<string, unknown> = {};

      for (const feature of view.features) {
        if (feature.transform) {
          features[feature.name] = feature.transform({ entityId });
        }
      }

      if (options.toOnline && this.onlineStore) {
        await this.pushOnlineFeatures(entityId, features);
      }

      if (options.toOffline && this.offlineStore) {
        await this.writeOfflineFeatures(entityId, features);
      }
    }

    logger.debug(`Materialized ${viewName} for ${entityIds.length} entities`);
  }

  /**
   * List all registered features
   */
  listFeatures(): FeatureMetadata[] {
    return Array.from(this.features.values());
  }

  /**
   * List all registered views
   */
  listViews(): string[] {
    return Array.from(this.views.keys());
  }

  /**
   * Get a specific view
   */
  getView(name: string): FeatureView | undefined {
    return this.views.get(name);
  }

  private groupByEntity(values: FeatureValue[]): Record<string, Record<string, unknown>> {
    const grouped: Record<string, Record<string, unknown>> = {};

    for (const v of values) {
      if (!grouped[v.entityId]) {
        grouped[v.entityId] = {};
      }
      grouped[v.entityId][v.featureName] = v.value;
    }

    return grouped;
  }

  async close(): Promise<void> {
    if (this.onlineStore) {
      await this.onlineStore.close();
    }
    if (this.offlineStore) {
      await this.offlineStore.close();
    }
    logger.debug('FeatureStore: closed all stores');
  }
}
