/**
 * Parse OpenAPI 3 / Swagger-like docs into operation candidates.
 */

import type {
  HttpMethod,
  OpenApiLike,
  OpenApiOperation,
  ParsedOperation,
  SkillParameter,
} from './types';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function toToolName(method: string, path: string, operationId?: string): string {
  if (operationId) return operationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleaned = path
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');
  return `${method.toLowerCase()}_${cleaned || 'root'}`;
}

function isOperation(value: unknown): value is OpenApiOperation {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convert Express-style `:id` paths to OpenAPI `{id}`.
 * Hazel swagger often emits colon params; Skillgate invokers expect braces.
 */
export function normalizeOpenApiPaths(spec: OpenApiLike): OpenApiLike {
  const paths = spec.paths ?? {};
  const next: NonNullable<OpenApiLike['paths']> = {};
  for (const [p, item] of Object.entries(paths)) {
    const openApiPath = p.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    next[openApiPath] = item;
  }
  spec.paths = next;
  return spec;
}

/** Convert an OpenAPI-like document into parsed operations (no filtering). */
export function parseOpenApiOperations(spec: OpenApiLike): ParsedOperation[] {
  const baseUrl = spec.servers?.[0]?.url;
  const ops: ParsedOperation[] = [];
  const paths = spec.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;

    for (const [method, raw] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!isOperation(raw)) continue;

      const parameters: SkillParameter[] = [];

      for (const p of raw.parameters ?? []) {
        parameters.push({
          name: p.name,
          type: p.schema?.type ?? 'string',
          description: p.description,
          required: p.required,
          in: (p.in as SkillParameter['in']) ?? 'query',
        });
      }

      const bodySchema =
        raw.requestBody?.content?.['application/json']?.schema ??
        raw.requestBody?.content?.['application/*']?.schema;
      if (bodySchema?.properties) {
        const required = new Set(bodySchema.required ?? []);
        for (const [name, schema] of Object.entries(bodySchema.properties)) {
          parameters.push({
            name,
            type: schema.type ?? 'string',
            description: schema.description,
            required: required.has(name),
            in: 'body',
          });
        }
      }

      const description = raw.summary || raw.description || `${method.toUpperCase()} ${path}`;

      ops.push({
        name: toToolName(method, path, raw.operationId),
        description,
        method: method.toUpperCase() as HttpMethod,
        path,
        parameters,
        tags: raw.tags ?? [],
        operationId: raw.operationId,
        baseUrl,
        xHazelSkill: raw['x-hazel-skill'],
      });
    }
  }

  return ops;
}
