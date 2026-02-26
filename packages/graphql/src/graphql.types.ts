/**
 * Types for @hazeljs/graphql
 */

export interface GraphQLModuleConfig {
  path?: string;
  playground?: boolean;
  introspection?: boolean;
}

export interface ObjectTypeMetadata {
  name: string;
  description?: string;
}

export interface FieldMetadata {
  name: string;
  type: unknown;
  description?: string;
  nullable?: boolean;
}

export interface ResolverMetadata {
  name?: string;
}

export interface QueryMetadata {
  name?: string;
  description?: string;
}

export interface MutationMetadata {
  name?: string;
  description?: string;
}

export interface ArgMetadata {
  name: string;
  type: unknown;
  description?: string;
  nullable?: boolean;
}
