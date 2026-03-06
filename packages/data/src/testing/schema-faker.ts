import type { BaseSchema } from '../schema/schema';

/**
 * Generate fake data that matches a schema.
 * Uses schema.toJsonSchema() to infer structure and produce valid sample data.
 *
 * @example
 * const UserSchema = Schema.object({ name: Schema.string(), age: Schema.number() });
 * const fake = SchemaFaker.generate(UserSchema);
 * // { name: "random-string-123", age: 42 }
 */
export class SchemaFaker {
  private readonly options: { arrayMinLength?: number; arrayMaxLength?: number };

  constructor(options: { arrayMinLength?: number; arrayMaxLength?: number } = {}) {
    this.options = { arrayMinLength: 1, arrayMaxLength: 5, ...options };
  }

  /**
   * Generate one fake record matching the schema.
   */
  generate<T>(schema: BaseSchema<T>): T {
    const js = schema.toJsonSchema();
    return this.generateFromJsonSchema(js) as T;
  }

  /**
   * Generate N fake records.
   */
  generateMany<T>(schema: BaseSchema<T>, count: number): T[] {
    return Array.from({ length: count }, () => this.generate(schema));
  }

  private generateFromJsonSchema(js: Record<string, unknown>): unknown {
    if (js.const !== undefined) return js.const;

    if (js.oneOf) {
      const schemas = js.oneOf as Record<string, unknown>[];
      const idx = Math.floor(Math.random() * schemas.length);
      return this.generateFromJsonSchema(schemas[idx] as Record<string, unknown>);
    }

    if (js.properties) {
      const out: Record<string, unknown> = {};
      const props = js.properties as Record<string, Record<string, unknown>>;
      for (const [k, v] of Object.entries(props)) {
        out[k] = this.generateFromJsonSchema(v);
      }
      return out;
    }

    if (js.items) {
      const len =
        Math.floor(
          Math.random() * (this.options.arrayMaxLength! - this.options.arrayMinLength! + 1)
        ) + this.options.arrayMinLength!;
      const itemSchema = js.items as Record<string, unknown>;
      return Array.from({ length: len }, () => this.generateFromJsonSchema(itemSchema));
    }

    const type = js.type;
    if (Array.isArray(type)) {
      const t = type.find((x) => x !== 'null') ?? 'string';
      return this.genByType(t as string, js);
    }
    if (typeof type === 'string') {
      return this.genByType(type, js);
    }

    return null;
  }

  private genByType(type: string, _js: Record<string, unknown>): unknown {
    switch (type) {
      case 'string':
        return this.randomString();
      case 'number':
      case 'integer':
        return Math.floor(Math.random() * 1000) - 100;
      case 'boolean':
        return Math.random() > 0.5;
      case 'object':
        return {};
      case 'array':
        return [];
      default:
        return null;
    }
  }

  private randomString(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const len = Math.floor(Math.random() * 10) + 5;
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      ''
    );
  }

  /** Static convenience method */
  static generate<T>(schema: BaseSchema<T>): T {
    return new SchemaFaker().generate(schema);
  }

  static generateMany<T>(schema: BaseSchema<T>, count: number): T[] {
    return new SchemaFaker().generateMany(schema, count);
  }
}
