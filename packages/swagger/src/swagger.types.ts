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

/** OpenAPI server entry */
export interface SwaggerServer {
  url: string;
  description?: string;
}

/** Options for building a document from the app module (HTTP + programmatic). */
export interface SwaggerBuildOptions {
  title?: string;
  description?: string;
  version?: string;
  /** When true (default), routes without `@ApiOperation` get a generated operation. */
  autoGenerateOperations?: boolean;
  /** Prepended to every path (e.g. match `app.setGlobalPrefix('/api')`). */
  globalPrefix?: string;
  servers?: SwaggerServer[];
  /** Merged into `components.securitySchemes`. */
  securitySchemes?: Record<string, Record<string, unknown>>;
  /** OpenAPI top-level `security` requirement. */
  security?: Array<Record<string, string[]>>;
}

/** @deprecated Use `SwaggerBuildOptions` — alias kept for backward compatibility. */
export type AutoSwaggerOptions = SwaggerBuildOptions;

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
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  /** OpenAPI component reference, e.g. `#/components/schemas/Error` */
  $ref?: string;
  format?: string;
  items?: SwaggerSchema;
  properties?: Record<string, SwaggerSchema>;
  required?: string[];
  example?: string | number | boolean | null | Record<string, unknown> | unknown[];
}

export interface SwaggerSpec {
  openapi: string;
  info: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: SwaggerServer[];
  paths: Record<string, Record<string, SwaggerOperation>>;
  components: {
    schemas: Record<string, SwaggerSchema>;
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description: string }>;
}

/** Runtime configuration for `SwaggerModule.configure()` (document + UI). */
export interface SwaggerModuleOptions extends SwaggerBuildOptions {
  /**
   * Base URL for Swagger UI static assets (no trailing slash).
   * Example: `https://unpkg.com/swagger-ui-dist@5.11.0`
   */
  swaggerUiCdnBase?: string;
}
