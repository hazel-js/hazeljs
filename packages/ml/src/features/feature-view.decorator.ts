/**
 * @FeatureView decorator - Define a collection of related features
 */

import 'reflect-metadata';

export const FEATURE_VIEW_METADATA_KEY = Symbol('hazel:feature-view:metadata');

export interface FeatureViewOptions {
  name: string;
  description?: string;
  entities: string[];
  online?: boolean;
  offline?: boolean;
  ttl?: number;
  source?: {
    type: 'batch' | 'stream' | 'request';
    config?: Record<string, unknown>;
  };
}

export interface FeatureViewMetadata {
  name: string;
  description?: string;
  entities: string[];
  online: boolean;
  offline: boolean;
  ttl?: number;
  source?: FeatureViewOptions['source'];
}

/**
 * Mark a class as a Feature View - a collection of related features.
 * Combine with @Feature on properties to define the feature schema.
 *
 * @example
 * ```typescript
 * @FeatureView({
 *   name: 'user-behavior',
 *   entities: ['user'],
 *   description: 'Features derived from user behavior',
 *   online: true,
 *   offline: true
 * })
 * class UserBehaviorFeatures {
 *   @Feature({ valueType: 'number' })
 *   loginCount: number;
 *
 *   @Feature({ valueType: 'number' })
 *   avgSessionDuration: number;
 * }
 * ```
 */
export function FeatureView(options: FeatureViewOptions): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return function (target: Function): void {
    const metadata: FeatureViewMetadata = {
      name: options.name,
      description: options.description,
      entities: options.entities,
      online: options.online ?? true,
      offline: options.offline ?? true,
      ttl: options.ttl,
      source: options.source,
    };

    Reflect.defineMetadata(FEATURE_VIEW_METADATA_KEY, metadata, target);
  };
}

export function getFeatureViewMetadata(target: object): FeatureViewMetadata | undefined {
  return Reflect.getMetadata(FEATURE_VIEW_METADATA_KEY, target);
}

export function hasFeatureViewMetadata(target: object): boolean {
  return Reflect.hasMetadata(FEATURE_VIEW_METADATA_KEY, target);
}
