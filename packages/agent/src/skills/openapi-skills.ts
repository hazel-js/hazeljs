/**
 * Agent OS Phase 3 — Dynamic Skills (OpenAPI → tool definitions)
 */

export interface DynamicSkillTool {
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    in?: 'path' | 'query' | 'header' | 'body';
  }>;
  /** Base URL from OpenAPI servers[0] when present. */
  baseUrl?: string;
}

export interface OpenApiLike {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; description?: string };
  servers?: Array<{ url: string }>;
  paths?: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in?: string;
          required?: boolean;
          description?: string;
          schema?: { type?: string };
        }>;
        requestBody?: {
          content?: Record<
            string,
            {
              schema?: { type?: string; properties?: Record<string, unknown>; required?: string[] };
            }
          >;
        };
      }
    >
  >;
}

function toToolName(method: string, path: string, operationId?: string): string {
  if (operationId) return operationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleaned = path
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');
  return `${method.toLowerCase()}_${cleaned || 'root'}`;
}

/** Convert an OpenAPI 3 / Swagger-like document into dynamic skill tools. */
export function openApiToSkills(spec: OpenApiLike): DynamicSkillTool[] {
  const baseUrl = spec.servers?.[0]?.url;
  const tools: DynamicSkillTool[] = [];
  const paths = spec.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (
        !['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())
      ) {
        continue;
      }
      const parameters: DynamicSkillTool['parameters'] = [];

      for (const p of op.parameters ?? []) {
        parameters.push({
          name: p.name,
          type: p.schema?.type ?? 'string',
          description: p.description,
          required: p.required,
          in: (p.in as DynamicSkillTool['parameters'][0]['in']) ?? 'query',
        });
      }

      const bodySchema =
        op.requestBody?.content?.['application/json']?.schema ??
        op.requestBody?.content?.['application/*']?.schema;
      if (bodySchema?.properties) {
        const required = new Set(bodySchema.required ?? []);
        for (const [name, schema] of Object.entries(bodySchema.properties)) {
          const s = schema as { type?: string; description?: string };
          parameters.push({
            name,
            type: s.type ?? 'string',
            description: s.description,
            required: required.has(name),
            in: 'body',
          });
        }
      }

      tools.push({
        name: toToolName(method, path, op.operationId),
        description: op.summary || op.description || `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        parameters,
        baseUrl,
      });
    }
  }

  return tools;
}

/**
 * Build a fetch-backed handler for a dynamic skill tool.
 * Returns an async function suitable for ToolRegistry.register / manual invoke.
 */
export function createSkillInvoker(
  tool: DynamicSkillTool,
  defaults: { baseUrl?: string; headers?: Record<string, string> } = {}
): (input: Record<string, unknown>) => Promise<unknown> {
  const base = defaults.baseUrl ?? tool.baseUrl ?? '';
  return async (input: Record<string, unknown>) => {
    let path = tool.path;
    const query: string[] = [];
    const headers: Record<string, string> = { ...(defaults.headers ?? {}) };
    let body: Record<string, unknown> | undefined;

    for (const p of tool.parameters) {
      const val = input[p.name];
      if (val === undefined) continue;
      if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(String(val)));
      else if (p.in === 'query')
        query.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(String(val))}`);
      else if (p.in === 'header') headers[p.name] = String(val);
      else {
        body = body ?? {};
        body[p.name] = val;
      }
    }

    // leftover keys go to body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(tool.method)) {
      body = body ?? {};
      for (const [k, v] of Object.entries(input)) {
        if (!(k in body) && !tool.parameters.some((p) => p.name === k && p.in !== 'body')) {
          body[k] = v;
        }
      }
    }

    const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}${
      query.length ? `?${query.join('&')}` : ''
    }`;

    const res = await fetch(url, {
      method: tool.method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: text };
    }
  };
}
