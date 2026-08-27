import 'reflect-metadata';
import type { QueryMetadata, MutationMetadata, ArgMetadata } from '../graphql.types';

export const QUERY_METADATA_KEY = Symbol('graphql:query');
export const MUTATION_METADATA_KEY = Symbol('graphql:mutation');
export const ARG_METADATA_KEY = Symbol('graphql:arg');

/**
 * Marks a method as a GraphQL Query
 */
export function Query(nameOrOptions?: string | Partial<QueryMetadata>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const meta: QueryMetadata =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions }
        : { name: String(propertyKey), ...nameOrOptions };
    const existing = Reflect.getMetadata(QUERY_METADATA_KEY, target.constructor) || [];
    existing.push({ ...meta, name: meta.name || String(propertyKey), method: String(propertyKey) });
    Reflect.defineMetadata(QUERY_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Marks a method as a GraphQL Mutation
 */
export function Mutation(nameOrOptions?: string | Partial<MutationMetadata>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const meta: MutationMetadata =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions }
        : { name: String(propertyKey), ...nameOrOptions };
    const existing = Reflect.getMetadata(MUTATION_METADATA_KEY, target.constructor) || [];
    existing.push({ ...meta, name: meta.name || String(propertyKey), method: String(propertyKey) });
    Reflect.defineMetadata(MUTATION_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Marks a parameter as a GraphQL argument
 */
export function Arg(
  nameOrOptions: string | Partial<ArgMetadata>,
  type?: unknown
): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const meta: ArgMetadata =
      typeof nameOrOptions === 'string'
        ? { name: nameOrOptions, type }
        : { name: nameOrOptions.name!, type: nameOrOptions.type, ...nameOrOptions };
    const key = propertyKey ?? '';
    const existing: ArgMetadata[] = Reflect.getMetadata(ARG_METADATA_KEY, target, key) || [];
    existing[parameterIndex] = meta;
    Reflect.defineMetadata(ARG_METADATA_KEY, existing, target, key);
  };
}

export function getQueryMetadata(target: object): Array<QueryMetadata & { method: string }> {
  return Reflect.getMetadata(QUERY_METADATA_KEY, target) || [];
}

export function getMutationMetadata(target: object): Array<MutationMetadata & { method: string }> {
  return Reflect.getMetadata(MUTATION_METADATA_KEY, target) || [];
}

export function getArgMetadata(target: object, propertyKey: string | symbol): ArgMetadata[] {
  return Reflect.getMetadata(ARG_METADATA_KEY, target, propertyKey) || [];
}
