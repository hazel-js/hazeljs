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

  it('generates literal', () => {
    const schema = Schema.literal('active');
    const value = SchemaFaker.generate(schema);
    expect(value).toBe('active');
  });

  it('generates array', () => {
    const schema = Schema.array(Schema.number());
    const value = SchemaFaker.generate(schema);
    expect(Array.isArray(value)).toBe(true);
    expect(schema.validate(value).success).toBe(true);
  });

  it('generates union', () => {
    const schema = Schema.union([Schema.literal('a'), Schema.literal('b')]);
    const value = SchemaFaker.generate(schema);
    expect(['a', 'b']).toContain(value);
  });

  it('constructor with custom array length options', () => {
    const faker = new SchemaFaker({ arrayMinLength: 2, arrayMaxLength: 4 });
    const schema = Schema.array(Schema.number());
    const value = faker.generate(schema);
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBeGreaterThanOrEqual(2);
    expect(value.length).toBeLessThanOrEqual(4);
  });

  it('generateFromJsonSchema handles nullable type array', () => {
    const schema = Schema.string().nullable();
    const value = SchemaFaker.generate(schema);
    expect(value === null || typeof value === 'string').toBe(true);
  });

  it('generates integer type', () => {
    const faker = new SchemaFaker();
    const schema = Schema.number();
    const value = faker.generate(schema);
    expect(typeof value).toBe('number');
  });

  it('generates nested objects', () => {
    const schema = Schema.object({
      user: Schema.object({
        name: Schema.string(),
        age: Schema.number(),
      }),
    });
    const value = SchemaFaker.generate(schema);
    expect(value).toHaveProperty('user');
    expect(value.user).toHaveProperty('name');
    expect(value.user).toHaveProperty('age');
  });

  it('generates array with custom length', () => {
    const faker = new SchemaFaker({ arrayMinLength: 5, arrayMaxLength: 5 });
    const schema = Schema.array(Schema.string());
    const value = faker.generate(schema);
    expect(Array.isArray(value)).toBe(true);
    expect(value.length).toBe(5);
  });

  it('generates optional fields', () => {
    const schema = Schema.object({
      required: Schema.string(),
      optional: Schema.string().optional(),
    });
    const value = SchemaFaker.generate(schema);
    expect(value).toHaveProperty('required');
  });
});
