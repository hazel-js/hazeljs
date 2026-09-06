import type { PolicyRule } from '@hazeljs/agent';
import type { ConstitutionDefinition, ConstitutionRule } from '../types/organism.types';
import { OrganismConstitutionError } from '../errors/organism.errors';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';

/**
 * Compiles constitution rules into PolicyEngine-compatible rules and
 * evaluates lifecycle actions against critical/high constraints.
 */
export class ConstitutionEnforcer {
  constructor(
    private readonly constitution: ConstitutionDefinition | undefined,
    private readonly events: OrganismEventEmitter,
    private readonly organismId: string
  ) {}

  getRules(): ConstitutionRule[] {
    return this.constitution?.rules ?? [];
  }

  /** Map critical/high textual rules into deny/approval PolicyEngine rules. */
  toPolicyRules(): PolicyRule[] {
    const rules = this.getRules();
    const out: PolicyRule[] = [];
    for (const rule of rules) {
      if (rule.severity !== 'critical' && rule.severity !== 'high') continue;
      const lower = rule.rule.toLowerCase();
      if (lower.includes('pii') || lower.includes('personally identifiable')) {
        out.push({
          id: `constitution:${rule.id}`,
          tool: '*',
          effect: 'deny',
          whenInputIncludes: 'ssn',
          reason: rule.rule,
          priority: 100,
        });
        out.push({
          id: `constitution:${rule.id}:email`,
          tool: '*',
          effect: 'mask',
          maskFields: ['email', 'phone', 'ssn', 'address'],
          reason: rule.rule,
          priority: 90,
        });
      }
      if (lower.includes('refund') && (lower.includes('approval') || lower.includes('human'))) {
        out.push({
          id: `constitution:${rule.id}`,
          tool: 'refund',
          effect: 'require_approval',
          reason: rule.rule,
          priority: 100,
        });
      }
      if (lower.includes('budget') || lower.includes('never exceed')) {
        out.push({
          id: `constitution:${rule.id}`,
          tool: '*',
          effect: 'require_approval',
          whenInputIncludes: 'override_budget',
          reason: rule.rule,
          priority: 100,
        });
      }
    }
    return out;
  }

  assertAllows(action: string, context: Record<string, unknown> = {}): void {
    for (const rule of this.getRules()) {
      if (rule.severity !== 'critical' && rule.severity !== 'high') continue;
      const lower = rule.rule.toLowerCase();

      if (
        (lower.includes('pii') || lower.includes('personally identifiable')) &&
        context.exposesPii === true
      ) {
        void this.events.emit(OrganismEventType.ORGANISM_CONSTITUTION_VIOLATION, this.organismId, {
          ruleId: rule.id,
          action,
          rule: rule.rule,
        });
        throw new OrganismConstitutionError(`Constitution violation (${rule.id}): ${rule.rule}`);
      }

      if (lower.includes('budget') && context.exceedsBudget === true) {
        void this.events.emit(OrganismEventType.ORGANISM_CONSTITUTION_VIOLATION, this.organismId, {
          ruleId: rule.id,
          action,
          rule: rule.rule,
        });
        throw new OrganismConstitutionError(`Constitution violation (${rule.id}): ${rule.rule}`);
      }

      if (
        lower.includes('refund') &&
        typeof context.refundAmount === 'number' &&
        context.refundAmount > 200 &&
        context.humanApproved !== true
      ) {
        const match = lower.match(/\$?(\d+)/);
        const limit = match ? Number(match[1]) : 200;
        if (context.refundAmount > limit) {
          void this.events.emit(
            OrganismEventType.ORGANISM_CONSTITUTION_VIOLATION,
            this.organismId,
            { ruleId: rule.id, action, rule: rule.rule }
          );
          throw new OrganismConstitutionError(`Constitution violation (${rule.id}): ${rule.rule}`);
        }
      }
    }
  }

  /** Child may only inherit a subset of parent permissions / capabilities. */
  subsetCapabilities(parent: string[], requested: string[]): string[] {
    const allowed = new Set(parent);
    return requested.filter((c) => allowed.has(c));
  }
}
