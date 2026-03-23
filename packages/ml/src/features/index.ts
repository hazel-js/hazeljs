/**
 * @hazeljs/ml - Feature Store
 *
 * Export all feature store components
 */

// Core types
export type {
  FeatureValueType,
  FeatureMetadata,
  FeatureValue,
  FeatureSet,
  FeatureView as FeatureViewType,
  FeatureDefinition,
  FeatureSource,
  FeatureQuery,
  FeatureResponse,
  OnlineStoreConfig,
  OfflineStoreConfig,
  FeatureStoreConfig,
} from './feature.types';

// Services
export { FeatureStoreService } from './feature-store.service';

// Stores
export {
  MemoryOnlineStore,
  RedisOnlineStore,
  createOnlineStore,
  type OnlineStore,
} from './online-store';
export {
  FileOfflineStore,
  PostgresOfflineStore,
  createOfflineStore,
  type OfflineStore,
} from './offline-store';

// Decorators
export {
  Feature,
  getFeatureMetadata,
  hasFeatureMetadata,
  type FeatureOptions,
  type FeatureMetadata as FeatureDecoratorMetadata,
} from './feature.decorator';
export {
  FeatureView,
  getFeatureViewMetadata,
  hasFeatureViewMetadata,
  type FeatureViewOptions,
  type FeatureViewMetadata,
} from './feature-view.decorator';
