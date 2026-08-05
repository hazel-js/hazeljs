/**
 * Skillgate public types
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type SkillClass = 'read' | 'write' | 'destructive' | 'admin';

/** OpenAPI `x-hazel-skill` extension (object or boolean). */
export interface XHazelSkill {
  enabled?: boolean;
  name?: string;
  description?: string;
  readOnly?: boolean;
  requiresApproval?: boolean;
  /** Force classification when set. */
  class?: SkillClass;
}

export interface SkillParameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  in?: 'path' | 'query' | 'header' | 'body';
}

/** One OpenAPI operation candidate before filtering / classification. */
export interface ParsedOperation {
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  parameters: SkillParameter[];
  tags: string[];
  operationId?: string;
  baseUrl?: string;
  xHazelSkill?: XHazelSkill | boolean;
}

/** A skill ready to register on ToolRegistry. */
export interface GovernedSkill {
  name: string;
  description: string;
  method: HttpMethod;
  path: string;
  parameters: SkillParameter[];
  baseUrl?: string;
  tags: string[];
  class: SkillClass;
  readOnly: boolean;
  requiresApproval: boolean;
  /** True when Skillgate denied this op (kept for reporting). */
  denied?: boolean;
  denyReason?: string;
}

export interface SkillgateIncludeOptions {
  /**
   * `opt-in` (default): only ops with x-hazel-skill, matching tags, operationIds, or paths.
   * `all`: every operation except deny / destructive defaults.
   */
  mode?: 'opt-in' | 'all';
  /** Tag allowlist. Default in opt-in with no other criteria: `['agent', 'skillgate']`. */
  tags?: string[];
  operationIds?: string[];
  paths?: Array<string | RegExp>;
  methods?: HttpMethod[];
  /** Match against tool name, path, or operationId — always excluded. */
  deny?: Array<string | RegExp>;
}

export interface SkillgateClassifyOptions {
  readMethods?: HttpMethod[];
  writeMethods?: HttpMethod[];
  destructiveMethods?: HttpMethod[];
  /** Path patterns treated as admin (denied unless allowAdmin). */
  adminPaths?: Array<string | RegExp>;
  writeRequiresApproval?: boolean;
  /** Allow DELETE / destructive methods when otherwise matching include. Default false. */
  allowDestructive?: boolean;
  /** Allow admin paths. Default false. */
  allowAdmin?: boolean;
}

export interface SkillgateInvokeOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  /**
   * When true, block private / loopback / cloud-metadata hosts for remote specs.
   * Default false — first-party Hazel backends often run on localhost.
   */
  ssrfProtection?: boolean;
}

export interface SkillgateOptions {
  include?: SkillgateIncludeOptions;
  classify?: SkillgateClassifyOptions;
  invoke?: SkillgateInvokeOptions;
  /** Warn when tool count exceeds this (default 12). */
  warnAbove?: number;
  /** Fail when tool count exceeds this unless force (default 24). */
  maxTools?: number;
  /** Allow exceeding maxTools. */
  force?: boolean;
  /** Reject skills with empty / placeholder descriptions. */
  strictDescriptions?: boolean;
  /** Agent name used when calling ToolRegistry.registerDynamicTool. Default `skillgate`. */
  agentName?: string;
}

/** Options for `Skillgate.fromModule` (requires `@hazeljs/swagger`). */
export interface SkillgateFromModuleOptions extends SkillgateOptions {
  /** Forwarded to swagger `createOpenApiDocument`. */
  swagger?: {
    title?: string;
    description?: string;
    version?: string;
    autoGenerateOperations?: boolean;
    globalPrefix?: string;
    servers?: Array<{ url: string; description?: string }>;
  };
  /**
   * When true (default), merge `@AgentSkill` metadata onto matching operations
   * as `x-hazel-skill`.
   */
  enrichAgentSkills?: boolean;
}

export interface SkillgateMcpOptions {
  name: string;
  version?: string;
  agentName?: string;
  /** Reuse an existing registry; otherwise a new ToolRegistry is created. */
  registry?: import('@hazeljs/agent').ToolRegistry;
}

export interface SkillgateReport {
  included: GovernedSkill[];
  denied: GovernedSkill[];
  warnings: string[];
}

/** Minimal OpenAPI-like document Skillgate can parse. */
export interface OpenApiLike {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; description?: string };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, OpenApiOperation | unknown>>;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
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
        schema?: {
          type?: string;
          properties?: Record<string, { type?: string; description?: string }>;
          required?: string[];
        };
      }
    >;
  };
  'x-hazel-skill'?: XHazelSkill | boolean;
}

export interface AgentSkillConfig {
  name?: string;
  description?: string;
  readOnly?: boolean;
  requiresApproval?: boolean;
  class?: SkillClass;
  /** When false, decorator marks the method as explicitly not a skill. */
  enabled?: boolean;
}
