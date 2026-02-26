import 'reflect-metadata';
import { Container } from '@hazeljs/core';
import { Injectable } from '@hazeljs/core';
import { SchemaBuilder } from './schema-builder';
import { Resolver } from './decorators/resolver.decorator';
import { Query, Mutation, Arg } from './decorators/query-mutation.decorator';
@Injectable()
@Resolver()
class TestResolver {
  @Query()
  hello() {
    return 'world';
  }

  @Query()
  user(@Arg('id') id: string) {
    return JSON.stringify({ id, name: `User ${id}` });
  }

  @Mutation()
  createUser(@Arg('name') name: string) {
    return JSON.stringify({ id: '1', name });
  }
}

describe('SchemaBuilder', () => {
  let container: Container;

  beforeEach(() => {
    container = Container.createTestInstance();
    container.register(TestResolver, new TestResolver());
  });

  it('should build schema with queries', () => {
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([TestResolver], container);
    expect(schema.getQueryType()).toBeDefined();
    expect(schema.getQueryType()?.getFields().hello).toBeDefined();
    expect(schema.getQueryType()?.getFields().user).toBeDefined();
  });

  it('should build schema with mutations', () => {
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([TestResolver], container);
    expect(schema.getMutationType()).toBeDefined();
    expect(schema.getMutationType()?.getFields().createUser).toBeDefined();
  });

  it('should execute query resolvers', async () => {
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([TestResolver], container);
    const { graphql } = await import('graphql');
    const result = await graphql({ schema, source: '{ hello }' });
    expect(result.data).toEqual({ hello: 'world' });
  });

  it('should execute query with args', async () => {
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([TestResolver], container);
    const { graphql } = await import('graphql');
    const result = await graphql({ schema, source: '{ user(id: "42") }' });
    expect(result.errors).toBeUndefined();
    expect(result.data?.user).toBeDefined();
    expect(JSON.parse(result.data!.user as string)).toMatchObject({ id: '42', name: 'User 42' });
  });

  it('should execute mutation', async () => {
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([TestResolver], container);
    const { graphql } = await import('graphql');
    const result = await graphql({
      schema,
      source: 'mutation { createUser(name: "Alice") }',
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.createUser).toBeDefined();
    expect(JSON.parse(result.data!.createUser as string)).toMatchObject({ id: '1', name: 'Alice' });
  });

  it('should handle resolver with missing method', async () => {
    @Injectable()
    @Resolver()
    class IncompleteResolver {
      @Query()
      hello() {
        return 'ok';
      }
    }
    const instance = new (class {
      /* no hello method */
    })() as IncompleteResolver;
    container.register(IncompleteResolver, instance);
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([IncompleteResolver], container);
    const { graphql } = await import('graphql');
    const result = await graphql({ schema, source: '{ hello }' });
    expect(result.data?.hello).toBeNull();
  });

  it('should build mutation type only when mutations exist', () => {
    @Injectable()
    @Resolver()
    class QueryOnlyResolver {
      @Query()
      only() {
        return 'ok';
      }
    }
    container.register(QueryOnlyResolver, new QueryOnlyResolver());
    const builder = new SchemaBuilder();
    const schema = builder.buildSchema([QueryOnlyResolver], container);
    expect(schema.getMutationType()).toBeUndefined();
  });
});
