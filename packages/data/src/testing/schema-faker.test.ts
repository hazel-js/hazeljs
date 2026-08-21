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

  it('generates email uuid uri and patterned strings', () => {
    const email = SchemaFaker.generate(Schema.string().email());
    expect(email).toMatch(/@example\.com$/);
    const uuid = SchemaFaker.generate(Schema.string().uuid());
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const uri = SchemaFaker.generate(Schema.string().url());
    expect(uri).toMatch(/^https:\/\/example\.com\//);
    const patterned = SchemaFaker.generate(Schema.string().pattern(/^[A-Z]+$/));
    expect(typeof patterned).toBe('string');
  });

  it('generates enum oneOf and respects min/max length', () => {
    const enumed = SchemaFaker.generate(Schema.string().oneOf(['x', 'y']));
    expect(['x', 'y']).toContain(enumed);
    const sized = SchemaFaker.generate(Schema.string().min(3).max(3));
    expect(sized).toHaveLength(3);
  });

  it('covers genByType object/array/default via json-schema shapes', () => {
    const faker = new SchemaFaker();
    const gen = (js: Record<string, unknown>) =>
      (
        faker as unknown as { generateFromJsonSchema: (j: Record<string, unknown>) => unknown }
      ).generateFromJsonSchema(js);

    expect(gen({ type: 'object' })).toEqual({});
    expect(gen({ type: 'array' })).toEqual([]);
    expect(gen({ type: 'unknown-type' })).toBeNull();
    expect(gen({})).toBeNull();
    expect(gen({ enum: ['a', 'b'] })).toMatch(/a|b/);
    expect(gen({ const: 42 })).toBe(42);
  });
});
