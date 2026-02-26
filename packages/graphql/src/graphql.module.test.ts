import 'reflect-metadata';
import { Container } from '@hazeljs/core';
import { HazelApp } from '@hazeljs/core';
import { GraphQLModule } from './graphql.module';
import { GraphQLServer } from './graphql.server';
import { Query } from './decorators/query-mutation.decorator';
import { Resolver } from './decorators/resolver.decorator';
import { HazelModule } from '@hazeljs/core';

@Resolver()
class TestResolver {
  @Query()
  hello() {
    return 'world';
  }
}

@HazelModule({
  imports: [
    GraphQLModule.forRoot({
      path: '/graphql',
      resolvers: [TestResolver],
    }),
  ],
})
class TestModule {}

describe('GraphQLModule', () => {
  let container: Container;
  const originalGetInstance = Container.getInstance;

  beforeEach(() => {
    container = Container.createTestInstance();
    (Container as { getInstance: () => Container }).getInstance = jest.fn(() => container);
  });

  afterEach(() => {
    (Container as { getInstance: () => Container }).getInstance = originalGetInstance;
  });

  describe('forRoot', () => {
    it('should return module config with providers and exports', () => {
      expect(TestModule).toBeDefined();
      const config = GraphQLModule.forRoot({
        path: '/graphql',
        resolvers: [TestResolver],
      });

      expect(config.module).toBe(GraphQLModule);
      expect(config.providers).toHaveLength(2);
      expect(config.providers[0]).toMatchObject({ provide: GraphQLServer });
      expect((config.providers[0] as { useFactory: () => unknown }).useFactory).toBeDefined();
      expect(config.exports).toContain(GraphQLServer);
      expect(config.global).toBe(true);
    });

    it('should create GraphQLServer via factory', () => {
      const mockApp = { addEarlyHandler: jest.fn() } as unknown as import('@hazeljs/core').HazelApp;
      container.register(HazelApp, mockApp);
      container.register(TestResolver, new TestResolver());

      const config = GraphQLModule.forRoot({
        path: '/api/gql',
        resolvers: [TestResolver],
      });
      const factory = (config.providers[0] as { useFactory: () => GraphQLServer }).useFactory;
      const server = factory();

      expect(server).toBeInstanceOf(GraphQLServer);
      expect(server.getPath()).toBe('/api/gql');
      expect(mockApp.addEarlyHandler).toHaveBeenCalledWith('/api/gql', expect.any(Function));
    });
  });
});
