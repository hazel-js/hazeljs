import type {
  AssembledContext,
  ContextAssemblyOptions,
  ContextContribution,
  ContextPlan,
} from '../types';

/** Matches @hazeljs/ai / CAG rough heuristic. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4) + 4;
}

const LABELS: Record<string, string> = {
  cag: 'Cached context',
  rag: 'Retrieved documents',
  kag: 'Knowledge graph',
  memory: 'Memory',
};

/**
 * Merges contributor outputs into a single prompt-ready context block
 * under an optional token budget (drops lowest-priority / last sources first).
 */
export class ContextAssembler {
  constructor(private readonly options: ContextAssemblyOptions = {}) {}

  assemble(plan: ContextPlan, contributions: ContextContribution[]): AssembledContext {
    const maxTokens = this.options.maxTokens ?? 50_000;
    const separator = this.options.separator ?? '\n\n---\n\n';

    // Keep plan order
    const ordered = plan.sources
      .map((kind) => contributions.find((c) => c.kind === kind && c.text.trim()))
      .filter((c): c is ContextContribution => Boolean(c));

    const kept: ContextContribution[] = [];
    let tokens = 0;
    for (const contribution of ordered) {
      const block = formatBlock(contribution);
      const cost = estimateTokens(block);
      if (tokens + cost > maxTokens) {
        continue;
      }
      kept.push(contribution);
      tokens += cost;
    }

    const text = kept.map(formatBlock).join(separator);
    return {
      text,
      contributions: kept,
      plan,
      tokenEstimate: estimateTokens(text),
      sourcesUsed: kept.map((c) => c.kind),
    };
  }
}

function formatBlock(contribution: ContextContribution): string {
  const label = LABELS[contribution.kind] ?? contribution.kind;
  return `[${label}]\n${contribution.text.trim()}`;
}
