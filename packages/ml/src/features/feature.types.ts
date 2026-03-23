/**
 * @hazeljs/ml - Feature Store Type Definitions
 */

export type FeatureValueType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FeatureMetadata {
  name: string;
  description?: string;
  valueType: FeatureValueType;
  tags?: string[];
  owner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureValue {
  entityId: string;
  featureName: string;
  value: unknown;
  timestamp: Date;
  version?: string;
}

export interface FeatureSet {
  name: string;
  description?: string;
  features: string[];
  entities: string[];
  source?: string;
  ttl?: number;
  version: string;
  createdAt: Date;
}

export interface FeatureView {
  name: string;
  description?: string;
  features: FeatureDefinition[];
  entities: string[];
  source: FeatureSource;
  ttl?: number;
  online?: boolean;
  offline?: boolean;
}

export interface FeatureDefinition {
  name: string;
  valueType: FeatureValueType;
  description?: string;
  transform?: (input: unknown) => unknown;
}

export interface FeatureSource {
  type: 'batch' | 'stream' | 'request';
  config: Record<string, unknown>;
}

export interface FeatureQuery {
  entityIds: string[];
  featureNames: string[];
  timestamp?: Date;
}

export interface FeatureResponse {
  entityId: string;
  features: Record<string, unknown>;
  timestamp: Date;
}

export interface OnlineStoreConfig {
  type: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export interface OfflineStoreConfig {
  type: 'file' | 'postgres' | 's3';
  file?: {
    path: string;
  };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  s3?: {
    bucket: string;
    region: string;
    prefix?: string;
  };
}

export interface FeatureStoreConfig {
  online?: OnlineStoreConfig;
  offline?: OfflineStoreConfig;
  enablePointInTime?: boolean;
}
