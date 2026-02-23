import 'reflect-metadata';
import { Resolver, getResolverMetadata } from './resolver.decorator';

describe('Resolver decorator', () => {
  it('should add empty metadata when no name', () => {
    @Resolver()
    class UserResolver {}
    const meta = getResolverMetadata(UserResolver);
    expect(meta).toEqual({});
  });

  it('should add metadata with custom name', () => {
    @Resolver('User')
    class UserResolver {}
    const meta = getResolverMetadata(UserResolver);
    expect(meta).toEqual({ name: 'User' });
  });

  it('should return undefined for class without decorator', () => {
    class Plain {}
    const meta = getResolverMetadata(Plain);
    expect(meta).toBeUndefined();
  });
});
