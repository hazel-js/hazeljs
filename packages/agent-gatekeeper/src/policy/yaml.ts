/**
 * YAML policy loader for agent-gatekeeper.yaml
 */

import { parse as parseYaml } from 'yaml';
import { GatekeeperConfigurationError } from '../errors';
import type { AgentGatekeeperPolicy, ToolClassification } from '../types';

export interface YamlPolicyDocument {
  mode?: 'enforce' | 'audit' | 'disabled';
  defaultDecision?: 'allow' | 'deny';
  policies?: YamlPolicyEntry[];
}

export interface YamlPolicyEntry {
  id: string;
  version: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  match?: {
    agents?: string[];
    agentVersions?: string[];
    roles?: string[];
    trustLevels?: string[];
    tenants?: string[];
    delegatedUsers?: string[];
    tools?: string[];
    environments?: string[];
    classifications?: ToolClassification[];
  };
  rules?: {
    maxTransactionAmount?: number;
    enforceTenantField?: string;
    stripFields?: string[];
    redactFields?: string[];
    rateLimit?: { max: number; windowMs: number };
    costBudget?: { maxUnits: number; windowMs: number };
    invocationBudget?: { max: number };
    /** Declarative deny when input field equals value */
    denyWhenFieldEquals?: Array<{ field: string; value: unknown }>;
    /** Declarative require approval when numeric field exceeds threshold */
    requireApprovalWhenFieldGt?: Array<{ field: string; threshold: number }>;
  };
}

export function parseYamlPolicies(content: string): YamlPolicyDocument {
  try {
    const doc = parseYaml(content) as YamlPolicyDocument;
    if (!doc || typeof doc !== 'object') {
      throw new GatekeeperConfigurationError('Invalid YAML: expected object document');
    }
    return doc;
  } catch (err) {
    if (err instanceof GatekeeperConfigurationError) throw err;
    throw new GatekeeperConfigurationError(
      `Failed to parse YAML: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

export function yamlEntryToPolicy(entry: YamlPolicyEntry): AgentGatekeeperPolicy {
  const policy: AgentGatekeeperPolicy = {
    id: entry.id,
    version: entry.version,
    priority: entry.priority,
    metadata: entry.metadata,
    match: entry.match,
  };

  if (entry.rules) {
    policy.rules = {};

    if (entry.rules.maxTransactionAmount != null) {
      policy.rules.maxTransactionAmount = entry.rules.maxTransactionAmount;
    }
    if (entry.rules.enforceTenantField) {
      policy.rules.enforceTenantField = entry.rules.enforceTenantField;
    }
    if (entry.rules.stripFields) {
      policy.rules.stripFields = entry.rules.stripFields;
    }
    if (entry.rules.redactFields) {
      policy.rules.redactFields = entry.rules.redactFields;
    }
    if (entry.rules.rateLimit) {
      policy.rules.rateLimit = entry.rules.rateLimit;
    }
    if (entry.rules.costBudget) {
      policy.rules.costBudget = entry.rules.costBudget;
    }
    if (entry.rules.invocationBudget) {
      policy.rules.invocationBudget = entry.rules.invocationBudget;
    }

    if (entry.rules.denyWhenFieldEquals?.length) {
      const conditions = entry.rules.denyWhenFieldEquals;
      policy.rules.denyWhen = ({ input }): boolean => {
        const obj = input as Record<string, unknown>;
        return conditions.some((c) => obj[c.field] === c.value);
      };
    }

    if (entry.rules.requireApprovalWhenFieldGt?.length) {
      const conditions = entry.rules.requireApprovalWhenFieldGt;
      policy.rules.requireApprovalWhen = ({ input }): boolean => {
        const obj = input as Record<string, unknown>;
        return conditions.some(
          (c) => typeof obj[c.field] === 'number' && (obj[c.field] as number) > c.threshold
        );
      };
    }
  }

  return policy;
}

export function loadPoliciesFromYaml(content: string): {
  mode?: YamlPolicyDocument['mode'];
  defaultDecision?: YamlPolicyDocument['defaultDecision'];
  policies: AgentGatekeeperPolicy[];
} {
  const doc = parseYamlPolicies(content);
  const policies = (doc.policies ?? []).map(yamlEntryToPolicy);
  validatePolicies(policies);
  return {
    mode: doc.mode,
    defaultDecision: doc.defaultDecision,
    policies,
  };
}

export function validatePolicies(policies: AgentGatekeeperPolicy[]): void {
  const ids = new Set<string>();
  for (const p of policies) {
    if (!p.id) {
      throw new GatekeeperConfigurationError('Policy missing id');
    }
    if (!p.version) {
      throw new GatekeeperConfigurationError(`Policy ${p.id} missing version`);
    }
    if (ids.has(p.id)) {
      throw new GatekeeperConfigurationError(`Duplicate policy id: ${p.id}`);
    }
    ids.add(p.id);
  }
}

export function loadPoliciesFromFileSync(
  fs: { readFileSync: (path: string, encoding: 'utf8') => string },
  filePath: string
): ReturnType<typeof loadPoliciesFromYaml> {
  const content = fs.readFileSync(filePath, 'utf8');
  return loadPoliciesFromYaml(content);
}
