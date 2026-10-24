/**
 * Industry / domain query templates for HeuristicQueryPlanner.
 *
 * Core KAG stays industry-agnostic. Apps compose a profile (or merge several)
 * that matches their relation vocabulary — commerce, healthcare, ops, etc.
 */

export interface QueryTemplate {
  name: string;
  /** Matched against the natural-language question. */
  pattern: RegExp;
  /** Optional relation-type filter for BFS. Omit to traverse all edges. */
  relationTypes?: string[];
  depth?: number;
}

export interface IndustryProfile {
  /** Stable id, e.g. "commerce", "healthcare", "generic". */
  id: string;
  templates: QueryTemplate[];
  /** Default traversal depth when no template matches. */
  defaultDepth?: number;
}

/**
 * Domain-neutral defaults: intent shaping only — no industry relation names.
 * Relation filters are left open so any graph vocabulary works.
 */
export const GENERIC_INDUSTRY_PROFILE: IndustryProfile = {
  id: 'generic',
  defaultDepth: 3,
  templates: [
    {
      name: 'causal',
      pattern: /\b(why|cause|because|reason|led to|resulted|affect|impact|driven)\b/i,
      depth: 4,
    },
    {
      name: 'temporal',
      pattern: /\b(when|was|were|before|after|changed|previously|currently|as of)\b/i,
      depth: 3,
    },
    {
      name: 'comparison',
      pattern: /\b(lower|higher|vs|versus|compared|difference|delta|increase|decrease)\b/i,
      depth: 3,
    },
  ],
};

/**
 * Optional commerce / payments vocabulary (orders, refunds, settlements).
 * Pass explicitly — never the default for all KAG apps.
 */
export const COMMERCE_INDUSTRY_PROFILE: IndustryProfile = {
  id: 'commerce',
  defaultDepth: 3,
  templates: [
    {
      name: 'settlement',
      pattern: /settlement|payout|profit|revenue|merchant/i,
      relationTypes: ['HAS_ORDER', 'HAS_PAYMENT', 'HAS_REFUND', 'HAS_FEE', 'AFFECTS', 'SETTLED_BY'],
      depth: 4,
    },
    {
      name: 'refund',
      pattern: /refund/i,
      relationTypes: ['HAS_ORDER', 'HAS_PAYMENT', 'HAS_REFUND', 'REFUNDED_BY'],
      depth: 3,
    },
    {
      name: 'price',
      pattern: /price|catalog|sku|product cost/i,
      relationTypes: ['HAS_PRODUCT', 'PRICED_AS'],
      depth: 2,
    },
  ],
};

/** Merge profiles; later templates win on same `name`. */
export function mergeIndustryProfiles(...profiles: IndustryProfile[]): IndustryProfile {
  const byName = new Map<string, QueryTemplate>();
  let defaultDepth = 3;
  const ids: string[] = [];
  for (const profile of profiles) {
    ids.push(profile.id);
    if (profile.defaultDepth !== undefined) {
      defaultDepth = profile.defaultDepth;
    }
    for (const template of profile.templates) {
      byName.set(template.name, template);
    }
  }
  return {
    id: ids.join('+') || 'custom',
    defaultDepth,
    templates: [...byName.values()],
  };
}
