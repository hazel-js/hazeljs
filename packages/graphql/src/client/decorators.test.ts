import 'reflect-metadata';
import {
  GraphQLQuery,
  GraphQLMutation,
  GraphQLClientClass,
  getGraphQLClientConfig,
} from './decorators';

describe('GraphQL client decorators', () => {
  describe('GraphQLQuery', () => {
    it('should apply without error', () => {
      class TestClient {
        @GraphQLQuery()
        getUsers() {
          return 'query { users { id } }';
        }
      }
      expect(new TestClient().getUsers()).toBe('query { users { id } }');
    });

    it('should support multiple methods', () => {
      class TestClient {
        @GraphQLQuery()
        one() {
          return 'query { one }';
        }
        @GraphQLQuery()
        two() {
          return 'query { two }';
        }
      }
      const client = new TestClient();
      expect(client.one()).toBe('query { one }');
      expect(client.two()).toBe('query { two }');
    });
  });

  describe('GraphQLMutation', () => {
    it('should apply without error', () => {
      class TestClient {
        @GraphQLMutation()
        createUser() {
          return 'mutation { createUser { id } }';
        }
      }
      expect(new TestClient().createUser()).toBe('mutation { createUser { id } }');
    });
  });

  describe('GraphQLClientClass', () => {
    it('should store url in metadata', () => {
      @GraphQLClientClass('http://localhost:3000/graphql')
      class TestClient {}
      const config = getGraphQLClientConfig(TestClient);
      expect(config.url).toBe('http://localhost:3000/graphql');
      expect(config.headers).toEqual({});
    });

    it('should store url and headers in metadata', () => {
      @GraphQLClientClass('http://api.example.com/gql', { Authorization: 'Bearer x' })
      class TestClient {}
      const config = getGraphQLClientConfig(TestClient);
      expect(config.url).toBe('http://api.example.com/gql');
      expect(config.headers).toEqual({ Authorization: 'Bearer x' });
    });
  });

  describe('getGraphQLClientConfig', () => {
    it('should return defaults for class without decorator', () => {
      class Plain {}
      const config = getGraphQLClientConfig(Plain);
      expect(config).toEqual({ url: '', headers: {} });
    });
  });
});
