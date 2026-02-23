import { Container, HazelApp, Injectable } from '@hazeljs/core';
import { GraphQLServer } from './graphql.server';
import type { GraphQLModuleConfig } from './graphql.types';
import type { Type } from '@hazeljs/core';

/** Eagerly resolves GraphQLServer so the early handler gets registered */
@Injectable()
class GraphQLBootstrap {
  constructor(_server: GraphQLServer) {}
}

/**
 * GraphQL module for HazelJS
 * Decorator-based schema with @Resolver, @Query, @Mutation, @ObjectType, @Field
 *
 * @example
 * ```typescript
 * @HazelModule({
 *   imports: [
 *     GraphQLModule.forRoot({
 *       path: '/graphql',
 *       resolvers: [UserResolver, PostResolver],
 *     })
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export class GraphQLModule {
  static forRoot(options: GraphQLModuleConfig & { resolvers: Type<object>[] }): {
    module: typeof GraphQLModule;
    providers: unknown[];
    exports: Array<typeof GraphQLServer>;
    global: boolean;
  } {
    const { resolvers, ...config } = options;

    const graphqlProvider = {
      provide: GraphQLServer,
      useFactory: (): GraphQLServer => {
        const container = Container.getInstance();
        const hazelApp = container.resolve(HazelApp);
        const server = new GraphQLServer(resolvers, container);
        server.configure(config);
        hazelApp.addEarlyHandler(server.getPath(), server.getHandler());
        return server;
      },
      inject: [] as (typeof Container)[],
    };

    return {
      module: GraphQLModule,
      providers: [graphqlProvider, GraphQLBootstrap],
      exports: [GraphQLServer],
      global: true,
    };
  }
}
