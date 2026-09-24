/**
 * Decision definition registry (compatible metadata for a future control-plane registry).
 */

import type { AgentDna, AgentDnaDecision } from '@hazeljs/agent';
import type { DecisionDefinition } from '../types';
import { DecisionValidationError } from '../errors';

export class DecisionRegistry {
  private readonly defs = new Map<string, DecisionDefinition>();

  register(def: DecisionDefinition): void {
    if (!def.name) throw new DecisionValidationError('Decision definition missing name');
    if (!def.choices?.length) {
      throw new DecisionValidationError(`Decision "${def.name}" must declare choices`);
    }
    this.defs.set(def.name, def);
  }

  registerFromDna(dna: AgentDna): void {
    const decisions = dna.decisions ?? {};
    for (const [name, d] of Object.entries(decisions)) {
      this.register({ name, ...d });
    }
  }

  get(name: string): DecisionDefinition | undefined {
    return this.defs.get(name);
  }

  require(name: string): DecisionDefinition {
    const d = this.defs.get(name);
    if (!d) throw new DecisionValidationError(`Unknown decision definition: ${name}`);
    return d;
  }

  list(): DecisionDefinition[] {
    return [...this.defs.values()];
  }

  merge(name: string | undefined, overlay?: AgentDnaDecision): AgentDnaDecision | undefined {
    const base = name ? this.defs.get(name) : undefined;
    if (!base && !overlay) return undefined;
    return {
      ...(base ?? {}),
      ...(overlay ?? {}),
      choices: overlay?.choices ?? base?.choices ?? [],
      objective: overlay?.objective ?? base?.objective ?? '',
    };
  }
}
