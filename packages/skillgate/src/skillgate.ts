/**
 * Skillgate — OpenAPI → curated, governed agent skills.
 */

import { createSkillInvoker, ToolRegistry, type DynamicSkillTool } from '@hazeljs/agent';
import { classifyOperation } from './classify';
import { defaultSkillgateOptions } from './defaults';
import { enrichSpecWithAgentSkills } from './enrich-agent-skills';
import { SkillgateConfigError } from './errors';
import { matchesInclude } from './filter';
import { parseOpenApiOperations } from './parse-openapi';
import { assertSafeBaseUrl } from './ssrf';
import type {
  GovernedSkill,
  OpenApiLike,
  ParsedOperation,
  SkillgateFromModuleOptions,
  SkillgateMcpOptions,
  SkillgateOptions,
  SkillgateReport,
  SkillParameter,
  XHazelSkill,
} from './types';

function resolveXHazel(raw?: XHazelSkill | boolean): XHazelSkill | undefined {
  if (raw === undefined || raw === false) return undefined;
  if (raw === true) return { enabled: true };
  return raw;
}

function toGoverned(op: ParsedOperation, options: SkillgateOptions): GovernedSkill {
  const classified = classifyOperation(op, options.classify);
  const x = resolveXHazel(op.xHazelSkill);

  return {
    name: x?.name ?? op.name,
    description: x?.description ?? op.description,
    method: op.method,
    path: op.path,
    parameters: op.parameters,
    baseUrl: op.baseUrl,
    tags: op.tags,
    class: classified.class,
    readOnly: classified.readOnly,
    requiresApproval: classified.requiresApproval,
    denied: classified.denied,
    denyReason: classified.denyReason,
  };
}

function toDynamicTool(skill: GovernedSkill): DynamicSkillTool {
  return {
    name: skill.name,
    description: skill.description,
    method: skill.method,
    path: skill.path,
    parameters: skill.parameters.map((p: SkillParameter) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      required: p.required,
      in: p.in,
    })),
    baseUrl: skill.baseUrl,
  };
}

function resolveHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = v.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => process.env[name] ?? '');
  }
  return out;
}

export class Skillgate {
  private readonly skills: GovernedSkill[];
  private readonly denied: GovernedSkill[];
  private readonly warnings: string[];
  private readonly options: SkillgateOptions;

  private constructor(
    skills: GovernedSkill[],
    denied: GovernedSkill[],
    warnings: string[],
    options: SkillgateOptions
  ) {
    this.skills = skills;
    this.denied = denied;
    this.warnings = warnings;
    this.options = options;
  }

  /** Build Skillgate from an OpenAPI 3 / Swagger-like document. */
  static fromOpenApi(spec: OpenApiLike, options: SkillgateOptions = {}): Skillgate {
    const opts = defaultSkillgateOptions(options);
    const warnAbove = opts.warnAbove ?? 12;
    const maxTools = opts.maxTools ?? 24;
    const warnings: string[] = [];
    const included: GovernedSkill[] = [];
    const denied: GovernedSkill[] = [];

    const baseUrl = opts.invoke?.baseUrl ?? spec.servers?.[0]?.url;
    assertSafeBaseUrl(baseUrl, opts.invoke?.ssrfProtection === true);

    if ((opts.include?.mode ?? 'opt-in') === 'all') {
      warnings.push(
        'include.mode is "all" — every non-denied operation becomes a skill. Prefer opt-in tags or x-hazel-skill in production.'
      );
    }

    const ops = parseOpenApiOperations(spec);

    for (const op of ops) {
      if (!matchesInclude(op, opts.include)) {
        continue;
      }

      const skill = toGoverned(op, opts);
      if (opts.invoke?.baseUrl) {
        skill.baseUrl = opts.invoke.baseUrl;
      }

      if (opts.strictDescriptions) {
        const d = skill.description.trim();
        if (!d || /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//i.test(d)) {
          denied.push({
            ...skill,
            denied: true,
            denyReason: 'strictDescriptions: missing meaningful summary/description',
          });
          continue;
        }
      }

      if (skill.denied) {
        denied.push(skill);
        continue;
      }

      included.push(skill);
    }

    if (included.length > warnAbove) {
      warnings.push(
        `Skillgate included ${included.length} skills (warnAbove=${warnAbove}). Large toolsets hurt LLM selection — curate with tags / allowlists.`
      );
    }

    if (included.length > maxTools && !opts.force) {
      throw new SkillgateConfigError(
        `Skillgate would register ${included.length} skills (maxTools=${maxTools}). Curate the surface or pass force: true.`
      );
    }

    return new Skillgate(included, denied, warnings, opts);
  }

  /**
   * Build Skillgate from a HazelJS root module via `@hazeljs/swagger`
   * `createOpenApiDocument` (zero hand-written OpenAPI).
   */
  static fromModule(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModule: new (...args: any[]) => unknown,
    options: SkillgateFromModuleOptions = {}
  ): Skillgate {
    let createOpenApiDocument: (mod: unknown, opts?: unknown) => OpenApiLike;
    let collectControllersFromModule: (mod: unknown) => Array<new (...args: unknown[]) => unknown>;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      createOpenApiDocument = require('@hazeljs/swagger').createOpenApiDocument;
    } catch {
      throw new SkillgateConfigError(
        'Skillgate.fromModule requires peer dependency @hazeljs/swagger. Install it or use Skillgate.fromOpenApi(spec).'
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      collectControllersFromModule = require('@hazeljs/core').collectControllersFromModule;
    } catch {
      throw new SkillgateConfigError(
        'Skillgate.fromModule requires @hazeljs/core (collectControllersFromModule).'
      );
    }

    const spec = createOpenApiDocument(rootModule, options.swagger) as OpenApiLike;

    if (options.enrichAgentSkills !== false) {
      const controllers = collectControllersFromModule(rootModule);
      enrichSpecWithAgentSkills(spec, controllers);
    }

    return Skillgate.fromOpenApi(spec, options);
  }

  /** Skills that will be registered. */
  list(): GovernedSkill[] {
    return [...this.skills];
  }

  /** Full report including denied ops and warnings. */
  report(): SkillgateReport {
    return {
      included: this.list(),
      denied: [...this.denied],
      warnings: [...this.warnings],
    };
  }

  /**
   * Register governed skills on a ToolRegistry for the given agent name.
   * Uses createSkillInvoker for HTTP execution.
   */
  register(registry: ToolRegistry, agentName?: string): number {
    const name = agentName ?? this.options.agentName ?? 'skillgate';
    const headers = resolveHeaders(this.options.invoke?.headers);
    const baseUrl = this.options.invoke?.baseUrl;

    for (const skill of this.skills) {
      const dynamic = toDynamicTool(skill);
      const handler = createSkillInvoker(dynamic, { baseUrl, headers });

      registry.registerDynamicTool(name, {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters.map((p) => ({
          name: p.name,
          type: (['string', 'number', 'boolean', 'object', 'array'].includes(p.type)
            ? p.type
            : 'string') as 'string' | 'number' | 'boolean' | 'object' | 'array',
          description: p.description ?? p.name,
          required: p.required,
        })),
        requiresApproval: skill.requiresApproval,
        readOnly: skill.readOnly,
        capability: `skillgate.${skill.class}.${skill.name}`,
        riskLevel:
          skill.class === 'destructive' ? 'high' : skill.class === 'write' ? 'medium' : 'low',
        idempotent: skill.readOnly,
        handler,
        metadata: {
          dynamic: true,
          skillgate: true,
          readOnly: skill.readOnly,
          class: skill.class,
          method: skill.method,
          path: skill.path,
          tags: skill.tags,
        },
      });
    }

    return this.skills.length;
  }

  /**
   * Register skills then create an MCP server (requires `@hazeljs/mcp`).
   */
  toMcpServer(options: SkillgateMcpOptions): {
    listenStdio: () => void;
    listTools: () => unknown[];
    handleRequest: (req: unknown) => Promise<unknown>;
  } {
    let createMcpServer: (opts: { name: string; version: string; toolRegistry: ToolRegistry }) => {
      listenStdio: () => void;
      listTools: () => unknown[];
      handleRequest: (req: unknown) => Promise<unknown>;
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      createMcpServer = require('@hazeljs/mcp').createMcpServer;
    } catch {
      throw new SkillgateConfigError(
        'Skillgate.toMcpServer requires peer dependency @hazeljs/mcp. Install it or call gate.register(registry) yourself.'
      );
    }

    const registry = options.registry ?? new ToolRegistry();
    this.register(registry, options.agentName);
    return createMcpServer({
      name: options.name,
      version: options.version ?? '1.0.0',
      toolRegistry: registry,
    });
  }
}
