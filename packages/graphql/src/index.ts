/**
 * @hazeljs/graphql - GraphQL server and client for HazelJS
 *
 * Server: decorator-based schema with @Resolver, @Query, @Mutation, @ObjectType, @Field
 * Client: typed GraphQLClient for queries and mutations
 */

// Module & Server
export { GraphQLModule } from './graphql.module';
export { GraphQLServer } from './graphql.server';

// Server decorators
export { ObjectType, getObjectTypeMetadata } from './decorators/object-type.decorator';
export { Field, getFieldMetadata } from './decorators/field.decorator';
export { Resolver, getResolverMetadata } from './decorators/resolver.decorator';
export {
  Query,
  Mutation,
  Arg,
  getQueryMetadata,
  getMutationMetadata,
  getArgMetadata,
} from './decorators/query-mutation.decorator';

// Client
export { GraphQLClient } from './client/graphql.client';
export {
  GraphQLQuery,
  GraphQLMutation,
  GraphQLClientClass,
  getGraphQLClientConfig,
} from './client/decorators';

// Types
export type {
  GraphQLModuleConfig,
  ObjectTypeMetadata,
  FieldMetadata,
  ResolverMetadata,
  QueryMetadata,
  MutationMetadata,
  ArgMetadata,
} from './graphql.types';
