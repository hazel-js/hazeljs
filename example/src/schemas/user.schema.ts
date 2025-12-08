import { ValidationSchema } from '@hazeljs/core';

export const userSchema: ValidationSchema = {
  name: {
    type: 'string',
    required: true,
    min: 2,
    max: 50,
  },
  age: {
    type: 'number',
    required: true,
    min: 0,
    max: 150,
  },
};
