/**
 * @Feature decorator - Mark a class property as a feature
 */

import 'reflect-metadata';

export const FEATURE_METADATA_KEY = Symbol('hazel:feature:metadata');

export interface FeatureOptions {
  name?: string;
  description?: string;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object';
  tags?: string[];
  ttl?: number;
  entityExtractor?: (input: unknown) => string;
}

export interface FeatureMetadata {
  propertyKey: string;
  name: string;
  description?: string;
  valueType: FeatureOptions['valueType'];
  tags?: string[];
  ttl?: number;
  entityExtractor?: (input: unknown) => string;
}

/**
 * Mark a class property as a feature for the Feature Store.
 * The property will be automatically discovered and registered.
 *
 * @example
 * ```typescript
 * @FeatureView({ name: 'user-features', entities: ['user'] })
 * class UserFeatures {
 *   @Feature({ valueType: 'number', description: 'User purchase count' })
 *   purchaseCount: number;
 *
 *   @Feature({ valueType: 'string', tags: ['demographic'] })
 *   segment: string;
 * }
 * ```
 */
export function Feature(options: FeatureOptions): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const metadata: FeatureMetadata = {
      propertyKey: propertyKey as string,
      name: options.name ?? (propertyKey as string),
      description: options.description,
      valueType: options.valueType,
      tags: options.tags,
      ttl: options.ttl,
      entityExtractor: options.entityExtractor,
    };

    const existing = Reflect.getMetadata(FEATURE_METADATA_KEY, target.constructor) || [];
    existing.push(metadata);
    Reflect.defineMetadata(FEATURE_METADATA_KEY, existing, target.constructor);
  };
}

export function getFeatureMetadata(target: object): FeatureMetadata[] | undefined {
  return Reflect.getMetadata(FEATURE_METADATA_KEY, target);
}

export function hasFeatureMetadata(target: object): boolean {
  return Reflect.hasMetadata(FEATURE_METADATA_KEY, target);
}
