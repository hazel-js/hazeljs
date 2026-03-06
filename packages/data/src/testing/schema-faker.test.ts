import { Schema } from '../schema/schema';
import { SchemaFaker } from './schema-faker';

describe('SchemaFaker', () => {
  it('generates string', () => {
    const schema = Schema.string();
    const value = SchemaFaker.generate(schema);
    expect(typeof value).toBe('string');
    expect(schema.validate(value).success).toBe(true);
  });

  it('generates number', () => {
    const schema = Schema.number();
    const value = SchemaFaker.generate(schema);
    expect(typeof value).toBe('number');
    expect(schema.validate(value).success).toBe(true);
  });

  it('generates boolean', () => {
    const schema = Schema.boolean();
    const value = SchemaFaker.generate(schema);
    expect(typeof value).toBe('boolean');
    expect(schema.validate(value).success).toBe(true);
  });

  it('generates object', () => {
    const schema = Schema.object({ name: Schema.string(), age: Schema.number() });
    const value = SchemaFaker.generate(schema);
    expect(value).toHaveProperty('name');
    expect(value).toHaveProperty('age');
    expect(schema.validate(value).success).toBe(true);
  });

  it('generateMany returns array', () => {
    const schema = Schema.object({ id: Schema.number() });
    const values = SchemaFaker.generateMany(schema, 3);
    expect(values).toHaveLength(3);
    values.forEach((v) => expect(schema.validate(v).success).toBe(true));
  });
});
