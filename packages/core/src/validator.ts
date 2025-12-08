import { ValidationSchema, ValidationError } from './types';

type ValidatableData = Record<string, unknown>;

export class Validator {
  static validate(data: ValidatableData, schema: ValidationSchema): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${field} is required`,
        });
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push({
              field,
              message: `${field} must be a string`,
            });
          } else {
            if (rules.min !== undefined && value.length < rules.min) {
              errors.push({
                field,
                message: `${field} must be at least ${rules.min} characters`,
              });
            }
            if (rules.max !== undefined && value.length > rules.max) {
              errors.push({
                field,
                message: `${field} must be at most ${rules.max} characters`,
              });
            }
            if (rules.pattern && !rules.pattern.test(value)) {
              errors.push({
                field,
                message: `${field} has invalid format`,
              });
            }
          }
          break;

        case 'number':
          if (typeof value !== 'number') {
            errors.push({
              field,
              message: `${field} must be a number`,
            });
          } else {
            if (rules.min !== undefined && value < rules.min) {
              errors.push({
                field,
                message: `${field} must be at least ${rules.min}`,
              });
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push({
                field,
                message: `${field} must be at most ${rules.max}`,
              });
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({
              field,
              message: `${field} must be a boolean`,
            });
          }
          break;

        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push({
              field,
              message: `${field} must be an object`,
            });
          } else if (rules.properties) {
            errors.push(...this.validate(value as ValidatableData, rules.properties));
          }
          break;

        case 'array':
          if (!Array.isArray(value)) {
            errors.push({
              field,
              message: `${field} must be an array`,
            });
          } else if (rules.items) {
            value.forEach((item, index) => {
              const itemSchema = {
                [`item_${index}`]: {
                  type: rules.items!.type,
                  required: rules.items!.required,
                  min: rules.items!.min,
                  max: rules.items!.max,
                  pattern: rules.items!.pattern,
                  properties: rules.items!.properties,
                  items: rules.items!.items,
                },
              } as unknown as ValidationSchema;
              const itemErrors = this.validate({ [`item_${index}`]: item }, itemSchema);
              errors.push(...itemErrors);
            });
          }
          break;
      }
    }

    return errors;
  }
}
