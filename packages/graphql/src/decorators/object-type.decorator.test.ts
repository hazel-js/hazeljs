import 'reflect-metadata';
import { ObjectType, getObjectTypeMetadata } from './object-type.decorator';

describe('ObjectType decorator', () => {
  it('should add metadata with class name when no options', () => {
    @ObjectType()
    class User {}
    const meta = getObjectTypeMetadata(User);
    expect(meta).toEqual({ name: 'User' });
  });

  it('should add metadata with custom name as string', () => {
    @ObjectType('CustomUser')
    class User {}
    const meta = getObjectTypeMetadata(User);
    expect(meta).toEqual({ name: 'CustomUser' });
  });

  it('should add metadata with options object', () => {
    @ObjectType({ name: 'Person', description: 'A person type' })
    class Person {}
    const meta = getObjectTypeMetadata(Person);
    expect(meta).toEqual({ name: 'Person', description: 'A person type' });
  });

  it('should return undefined for class without decorator', () => {
    class Plain {}
    const meta = getObjectTypeMetadata(Plain.prototype);
    expect(meta).toBeUndefined();
  });
});
