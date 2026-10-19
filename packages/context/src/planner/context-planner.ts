import type {
  ContextContributorKind,
  ContextPlan,
  ContextRequest,
  ContextSourceKind,
  ContextStrategy,
} from '../types';
import { normalizeSourceKind } from '../types';

export interface ContextPlannerOptions {
  strategy?: ContextStrategy;
  /** Allow-list / preferred order (aliases normalized). */
  sources?: ContextSourceKind[];
  /** Kinds that actually have a registered contributor. */
  available: ContextContributorKind[];
}

/**
 * Selects which context substrates to invoke for a query.
 *
 * auto heuristics (lightweight, no LLM):
 * - Stable / policy / config language → CAG
 * - Entity / why / relation language → KAG
 * - Personal / previously / preference → Memory
 * - Lookup / document / what is → RAG
 * - Complex or ambiguous → combine available sources in priority order
 */
export class ContextPlanner {
  private readonly strategy: ContextStrategy;
  private readonly preferred: ContextContributorKind[];
  private readonly available: Set<ContextContributorKind>;

  constructor(options: ContextPlannerOptions) {
    this.strategy = options.strategy ?? 'auto';
    this.preferred = (options.sources ?? ['cache', 'rag', 'knowledge', 'memory']).map(
      normalizeSourceKind
    );
    this.available = new Set(options.available);
  }

  plan(request: ContextRequest): ContextPlan {
    const rationale: string[] = [];
    let selected: ContextContributorKind[] = [];

    if (this.strategy === 'explicit') {
      selected = this.preferred.filter((k) => this.available.has(k));
      rationale.push('strategy=explicit: using configured sources allow-list');
    } else if (this.strategy === 'all') {
      selected = this.preferred.filter((k) => this.available.has(k));
      // Also include any available not in preferred
      for (const k of this.available) {
        if (!selected.includes(k)) selected.push(k);
      }
      rationale.push('strategy=all: invoking every registered contributor');
    } else {
      selected = this.planAuto(request.query, rationale);
    }

    // Stable order: preferred order first, then any extras
    selected = orderByPreferred(selected, this.preferred);

    return { sources: selected, rationale };
  }

  private planAuto(query: string, rationale: string[]): ContextContributorKind[] {
    const q = query.toLowerCase();
    const picked = new Set<ContextContributorKind>();

    const wantCag =
      /\b(policy|policies|procedure|compliance|schema|catalog|config|configuration|operating|instructions?|handbook|sop)\b/i.test(
        q
      );
    const wantKag =
      /\b(why|how related|relationship|entity|entities|graph|connected|cause|affect|impact|settlement|refund|who|which)\b/i.test(
        q
      );
    const wantMemory =
      /\b(previously|last time|remember|preference|prefer|my|I asked|earlier|session)\b/i.test(q);
    const wantRag =
      /\b(document|docs?|manual|article|search|look up|find|what is|explain|describe|according to)\b/i.test(
        q
      ) || q.split(/\s+/).length >= 6;

    if (wantCag && this.available.has('cag')) {
      picked.add('cag');
      rationale.push('auto: stable/policy language → cag');
    }
    if (wantKag && this.available.has('kag')) {
      picked.add('kag');
      rationale.push('auto: relational/causal language → kag');
    }
    if (wantMemory && this.available.has('memory')) {
      picked.add('memory');
      rationale.push('auto: personal/history language → memory');
    }
    if (wantRag && this.available.has('rag')) {
      picked.add('rag');
      rationale.push('auto: document/lookup language → rag');
    }

    // Ambiguous / complex: combine available preferred sources
    if (picked.size === 0 || (picked.size === 1 && q.split(/\s+/).length >= 10)) {
      for (const kind of this.preferred) {
        if (this.available.has(kind)) {
          picked.add(kind);
        }
      }
      rationale.push('auto: falling back to configured preferred sources');
    }

    return [...picked];
  }
}

function orderByPreferred(
  selected: ContextContributorKind[],
  preferred: ContextContributorKind[]
): ContextContributorKind[] {
  const set = new Set(selected);
  const ordered: ContextContributorKind[] = [];
  for (const k of preferred) {
    if (set.has(k)) {
      ordered.push(k);
      set.delete(k);
    }
  }
  for (const k of set) ordered.push(k);
  return ordered;
}
