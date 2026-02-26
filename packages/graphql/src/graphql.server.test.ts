import 'reflect-metadata';
import { Container } from '@hazeljs/core';
import { Injectable } from '@hazeljs/core';
import { GraphQLServer } from './graphql.server';
import { Query } from './decorators/query-mutation.decorator';
import { Resolver } from './decorators/resolver.decorator';

jest.mock('graphql-http/lib/use/http', () => ({
  createHandler: jest.fn().mockReturnValue(jest.fn()),
}));

@Injectable()
@Resolver()
class TestResolver {
  @Query()
  hello() {
    return 'world';
  }
}

describe('GraphQLServer', () => {
  let container: Container;

  beforeEach(() => {
    container = Container.createTestInstance();
    container.register(TestResolver, new TestResolver());
  });

  describe('configure', () => {
    it('should set default path to /graphql', () => {
      const server = new GraphQLServer([TestResolver], container);
      expect(server.getPath()).toBe('/graphql');
    });

    it('should set custom path', () => {
      const server = new GraphQLServer([TestResolver], container);
      server.configure({ path: '/api/gql' });
      expect(server.getPath()).toBe('/api/gql');
    });
  });

  describe('getHandler', () => {
    it('should build and return handler on first call', () => {
      const server = new GraphQLServer([TestResolver], container);
      const handler = server.getHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should return same handler on subsequent calls', () => {
      const server = new GraphQLServer([TestResolver], container);
      const h1 = server.getHandler();
      const h2 = server.getHandler();
      expect(h1).toBe(h2);
    });
  });

  describe('getSchema', () => {
    it('should return null before build', () => {
      const server = new GraphQLServer([TestResolver], container);
      expect(server.getSchema()).toBeNull();
    });

    it('should return schema after getHandler', () => {
      const server = new GraphQLServer([TestResolver], container);
      server.getHandler();
      expect(server.getSchema()).toBeDefined();
      expect(server.getSchema()?.getQueryType()).toBeDefined();
    });
  });
});
