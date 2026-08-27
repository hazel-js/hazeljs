import 'reflect-metadata';

const GQL_QUERY_METADATA = Symbol('graphql:client:query');
const GQL_MUTATION_METADATA = Symbol('graphql:client:mutation');

/**
 * Decorator for a client method that executes a GraphQL query
 *
 * @example
 * ```typescript
 * @GraphQLClientClass('http://localhost:3000/graphql')
 * class UserClient {
 *   @GraphQLQuery()
 *   async getUser(id: string) {
 *     return `query { user(id: "${id}") { id name } }`;
 *   }
 * }
 * ```
 *
 * The method should return the GraphQL query string (or use a template literal)
 */
export function GraphQLQuery(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existing = Reflect.getMetadata(GQL_QUERY_METADATA, target.constructor) || [];
    existing.push(String(propertyKey));
    Reflect.defineMetadata(GQL_QUERY_METADATA, existing, target.constructor);
    return descriptor;
  };
}

/**
 * Decorator for a client method that executes a GraphQL mutation
 */
export function GraphQLMutation(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existing = Reflect.getMetadata(GQL_MUTATION_METADATA, target.constructor) || [];
    existing.push(String(propertyKey));
    Reflect.defineMetadata(GQL_MUTATION_METADATA, existing, target.constructor);
    return descriptor;
  };
}

/**
 * Class decorator - marks a class as a GraphQL client and injects the client
 *
 * @example
 * ```typescript
 * @GraphQLClientClass('http://localhost:3000/graphql')
 * class ApiClient {
 *   constructor(public client: GraphQLClient) {}
 *
 *   @GraphQLQuery()
 *   async hello() {
 *     return 'query { hello }';
 *   }
 * }
 * ```
 */
export function GraphQLClientClass(url: string, headers?: Record<string, string>): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata('graphql:client:url', url, target);
    Reflect.defineMetadata('graphql:client:headers', headers ?? {}, target);
  };
}

export function getGraphQLClientConfig(target: object): {
  url: string;
  headers: Record<string, string>;
} {
  return {
    url: Reflect.getMetadata('graphql:client:url', target) ?? '',
    headers: Reflect.getMetadata('graphql:client:headers', target) ?? {},
  };
}
