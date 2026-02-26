import 'reflect-metadata';
import {
  Query,
  Mutation,
  Arg,
  getQueryMetadata,
  getMutationMetadata,
  getArgMetadata,
} from './query-mutation.decorator';

describe('Query decorator', () => {
  it('should add metadata with method name as default', () => {
    class TestResolver {
      @Query()
      hello() {
        return 'hi';
      }
    }
    const meta = getQueryMetadata(TestResolver);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe('hello');
    expect(meta[0].method).toBe('hello');
  });

  it('should add metadata with custom name', () => {
    class TestResolver {
      @Query('getHello')
      hello() {
        return 'hi';
      }
    }
    const meta = getQueryMetadata(TestResolver);
    expect(meta[0].name).toBe('getHello');
    expect(meta[0].method).toBe('hello');
  });

  it('should support multiple queries', () => {
    class TestResolver {
      @Query()
      one() {}
      @Query()
      two() {}
    }
    const meta = getQueryMetadata(TestResolver);
    expect(meta).toHaveLength(2);
    expect(meta.map((m) => m.name)).toEqual(['one', 'two']);
  });
});

describe('Mutation decorator', () => {
  it('should add metadata with method name as default', () => {
    class TestResolver {
      @Mutation()
      createUser() {
        return { id: '1' };
      }
    }
    const meta = getMutationMetadata(TestResolver);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe('createUser');
    expect(meta[0].method).toBe('createUser');
  });

  it('should add metadata with custom name', () => {
    class TestResolver {
      @Mutation('addUser')
      createUser() {
        return {};
      }
    }
    const meta = getMutationMetadata(TestResolver);
    expect(meta[0].name).toBe('addUser');
  });
});

describe('Arg decorator', () => {
  it('should add metadata for parameter with string name', () => {
    class TestResolver {
      @Query()
      user(@Arg('id') _id: string) {
        return {};
      }
    }
    const meta = getArgMetadata(TestResolver.prototype, 'user');
    expect(meta).toHaveLength(1);
    expect(meta[0]?.name).toBe('id');
  });

  it('should add metadata with type', () => {
    class TestResolver {
      @Query()
      item(@Arg('id', String) _id: string) {
        return {};
      }
    }
    const meta = getArgMetadata(TestResolver.prototype, 'item');
    expect(meta[0]?.name).toBe('id');
    expect(meta[0]?.type).toBe(String);
  });

  it('should add metadata for multiple args in order', () => {
    class TestResolver {
      @Mutation()
      create(@Arg('a') _a: string, @Arg('b') _b: number) {
        return {};
      }
    }
    const meta = getArgMetadata(TestResolver.prototype, 'create');
    expect(meta).toHaveLength(2);
    expect(meta[0]?.name).toBe('a');
    expect(meta[1]?.name).toBe('b');
  });

  it('should return empty array when no args', () => {
    class TestResolver {
      @Query()
      hello() {
        return 'hi';
      }
    }
    const meta = getArgMetadata(TestResolver.prototype, 'hello');
    expect(meta).toEqual([]);
  });
});
