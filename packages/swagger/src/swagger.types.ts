export interface SwaggerOptions {
  title: string;
  description: string;
  version: string;
  path?: string;
  tags?: SwaggerTag[];
}

export interface SwaggerTag {
  name: string;
  description: string;
}

export interface SwaggerOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: {
    required?: boolean;
    content: {
      [contentType: string]: {
        schema: SwaggerSchema;
      };
    };
  };
  responses?: Record<string, SwaggerResponse>;
}

export interface SwaggerParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SwaggerSchema;
}

export interface SwaggerResponse {
  description: string;
  content?: {
    [contentType: string]: {
      schema: SwaggerSchema;
    };
  };
}

export interface SwaggerSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  items?: SwaggerSchema;
  properties?: Record<string, SwaggerSchema>;
  required?: string[];
  example?: string | number | boolean | null | Record<string, unknown> | unknown[];
}
