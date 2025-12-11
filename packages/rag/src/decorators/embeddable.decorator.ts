/**
 * @Embeddable Decorator
 * Automatically generates embeddings for entity fields
 */

import 'reflect-metadata';

export interface EmbeddableOptions {
  fields: string[];
  strategy?: 'concat' | 'weighted' | 'separate';
  model?: string;
  separator?: string;
  weights?: Record<string, number>;
}

const EMBEDDABLE_METADATA_KEY = Symbol('embeddable');

/**
 * Marks an entity as embeddable with automatic embedding generation
 */
export function Embeddable(options: EmbeddableOptions): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(EMBEDDABLE_METADATA_KEY, options, target);
    return target;
  };
}

/**
 * Get embeddable metadata from a class
 */
export function getEmbeddableMetadata(target: any): EmbeddableOptions | undefined {
  return Reflect.getMetadata(EMBEDDABLE_METADATA_KEY, target);
}

/**
 * Marks a property as a vector column for storing embeddings
 */
export function VectorColumn(): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const vectorColumns = Reflect.getMetadata('vectorColumns', target.constructor) || [];
    vectorColumns.push(propertyKey);
    Reflect.defineMetadata('vectorColumns', vectorColumns, target.constructor);
  };
}

/**
 * Get vector column metadata
 */
export function getVectorColumns(target: any): string[] {
  return Reflect.getMetadata('vectorColumns', target) || [];
}
