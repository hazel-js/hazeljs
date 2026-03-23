/**
 * @DataContract decorator - Define a data contract for a pipeline or dataset
 */

import 'reflect-metadata';

export const DATA_CONTRACT_METADATA_KEY = Symbol('hazel:data-contract:metadata');

export interface DataContractOptions {
  name: string;
  version: string;
  description?: string;
  owner: string;
  schema: Record<string, unknown>;
  sla?: {
    freshness?: {
      maxDelayMinutes: number;
      checkIntervalMinutes?: number;
    };
    completeness?: {
      minCompleteness: number;
      requiredFields: string[];
    };
    quality?: {
      minQualityScore: number;
      checks: string[];
    };
    availability?: {
      minUptime: number;
    };
  };
  consumers?: string[];
  producers?: string[];
  tags?: string[];
}

export interface DataContractMetadata extends DataContractOptions {
  status: 'active' | 'deprecated' | 'breaking';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mark a pipeline or class as having a data contract.
 * The contract defines the schema, SLA, and ownership of the data.
 *
 * @example
 * ```typescript
 * @DataContract({
 *   name: 'user-events',
 *   version: '1.0.0',
 *   owner: 'analytics-team',
 *   schema: {
 *     userId: { type: 'string', required: true },
 *     eventType: { type: 'string', required: true },
 *     timestamp: { type: 'date', required: true },
 *   },
 *   sla: {
 *     freshness: { maxDelayMinutes: 5 },
 *     completeness: { minCompleteness: 0.95, requiredFields: ['userId', 'eventType'] }
 *   },
 *   consumers: ['recommendation-service', 'analytics-dashboard']
 * })
 * @Pipeline('user-events-pipeline')
 * class UserEventsPipeline extends PipelineBase {
 *   // ...
 * }
 * ```
 */
export function DataContract(options: DataContractOptions) {
  return function <T extends { new (...args: unknown[]): object }>(target: T): void {
    const metadata: DataContractMetadata = {
      ...options,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    Reflect.defineMetadata(DATA_CONTRACT_METADATA_KEY, metadata, target);
  };
}

export function getDataContractMetadata(target: object): DataContractMetadata | undefined {
  return Reflect.getMetadata(DATA_CONTRACT_METADATA_KEY, target);
}

export function hasDataContractMetadata(target: object): boolean {
  return Reflect.hasMetadata(DATA_CONTRACT_METADATA_KEY, target);
}
