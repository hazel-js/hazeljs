import 'reflect-metadata';
import { Field, getFieldMetadata } from './field.decorator';

describe('Field decorator', () => {
  it('should add metadata for property with default name', () => {
    class User {
      @Field()
      id!: string;
    }
    const meta = getFieldMetadata(User.prototype);
    expect(meta).toHaveLength(1);
    expect(meta[0].name).toBe('id');
  });

  it('should add metadata with custom name as string', () => {
    class User {
      @Field('userId')
      id!: string;
    }
    const meta = getFieldMetadata(User.prototype);
    expect(meta[0].name).toBe('userId');
  });

  it('should add metadata with options object', () => {
    class User {
      @Field({ name: 'fullName', description: 'Full name' })
      name!: string;
    }
    const meta = getFieldMetadata(User.prototype);
    expect(meta[0]).toMatchObject({ name: 'fullName', description: 'Full name' });
  });

  it('should add metadata for multiple fields', () => {
    class User {
      @Field()
      id!: string;
      @Field()
      name!: string;
    }
    const meta = getFieldMetadata(User.prototype);
    expect(meta).toHaveLength(2);
    expect(meta.map((m) => m.name)).toEqual(['id', 'name']);
  });

  it('should return empty array for class without @Field', () => {
    class Plain {}
    const meta = getFieldMetadata(Plain.prototype);
    expect(meta).toEqual([]);
  });
});
