import type { KnowledgeEntity, KnowledgeQueryPlanner, KnowledgeScope } from '../types';
import {
  GENERIC_INDUSTRY_PROFILE,
  type IndustryProfile,
  type QueryTemplate,
} from './industry-profiles';

export interface HeuristicQueryPlannerOptions {
  /**
   * Industry / domain profile(s). Defaults to GENERIC_INDUSTRY_PROFILE
   * (no commerce-specific relation filters).
   */
  industry?: IndustryProfile | IndustryProfile[];
  /** Extra templates layered on top of the industry profile. */
  templates?: QueryTemplate[];
  /** Override default BFS depth when no template matches. */
  defaultDepth?: number;
}

/**
 * V1 planner: seed entities from the question + optional industry templates.
 *
 * Core behavior is industry-agnostic. Pass `COMMERCE_INDUSTRY_PROFILE` (or a
 * custom profile) when your graph uses domain-specific relation types.
 */
export class HeuristicQueryPlanner implements KnowledgeQueryPlanner {
  private readonly templates: QueryTemplate[];
  private readonly defaultDepth: number;
  private readonly industryId: string;

  constructor(options: HeuristicQueryPlannerOptions = {}) {
    const industries = normalizeIndustries(options.industry);
    const fromIndustry = industries.flatMap((p) => p.templates);
    this.templates = [...fromIndustry, ...(options.templates ?? [])];
    this.defaultDepth =
      options.defaultDepth ??
      industries.map((p) => p.defaultDepth).find((d) => d !== undefined) ??
      GENERIC_INDUSTRY_PROFILE.defaultDepth ??
      3;
    this.industryId = industries.map((p) => p.id).join('+') || 'generic';
  }

  getIndustryId(): string {
    return this.industryId;
  }

  async plan(
    question: string,
    context: { scope: KnowledgeScope; entities: KnowledgeEntity[] }
  ): Promise<{
    seedIds: string[];
    depth: number;
    relationTypes?: string[];
    template?: string;
  }> {
    const lower = question.toLowerCase();
    const seeds: string[] = [];

    for (const entity of context.entities) {
      const names = [
        entity.id.toLowerCase(),
        String(entity.properties.name ?? '').toLowerCase(),
        ...(entity.aliases ?? []).map((a) => a.toLowerCase()),
      ].filter(Boolean);

      for (const name of names) {
        if (name.length >= 3 && lower.includes(name)) {
          seeds.push(entity.id);
          break;
        }
      }
    }

    // Match entity type tokens in the question (domain-agnostic).
    if (seeds.length === 0) {
      for (const entity of context.entities) {
        if (lower.includes(entity.type.toLowerCase())) {
          seeds.push(entity.id);
        }
      }
    }

    const matches = this.templates.filter((t) => t.pattern.test(question));
    // Prefer domain templates that constrain relation types over generic intents.
    const template =
      matches.find((t) => t.relationTypes && t.relationTypes.length > 0) ?? matches[0];
    return {
      seedIds: [...new Set(seeds)].slice(0, 20),
      depth: template?.depth ?? this.defaultDepth,
      relationTypes: template?.relationTypes,
      template: template?.name,
    };
  }
}

function normalizeIndustries(industry?: IndustryProfile | IndustryProfile[]): IndustryProfile[] {
  if (!industry) {
    return [GENERIC_INDUSTRY_PROFILE];
  }
  return Array.isArray(industry) ? industry : [industry];
}
