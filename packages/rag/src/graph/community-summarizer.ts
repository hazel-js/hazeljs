/**
 * CommunitySummarizer
 *
 * Generates LLM-powered community reports for each detected community.
 * Each report contains:
 *  - A one-line title capturing the community's central theme
 *  - A 2-4 paragraph narrative summary
 *  - Bullet-point key findings
 *  - An importance rating 1–10
 *
 * These reports are the foundation of GraphRAG's **global search** mode:
 * instead of searching raw text, the system searches community reports,
 * which capture cross-document themes that are invisible to chunk-level
 * vector search.
 *
 * Performance note: reports are generated in parallel (Promise.all) with
 * a configurable concurrency limit so we don't overwhelm the LLM rate limit.
 */

import type { GraphCommunity, CommunityReport } from './graph.types';
import type { GraphStore } from './knowledge-graph';
import { PromptRegistry } from '@hazeljs/prompts';
import '../prompts/community-summary.prompt';
import { COMMUNITY_SUMMARY_KEY } from '../prompts/community-summary.prompt';

export interface CommunitySummarizerConfig {
  llm: (prompt: string) => Promise<string>;
  /** Max concurrent LLM calls. Default: 3. */
  concurrency?: number;
}

export class CommunitySummarizer {
  private readonly llm: (prompt: string) => Promise<string>;
  private readonly concurrency: number;

  constructor(config: CommunitySummarizerConfig) {
    this.llm = config.llm;
    this.concurrency = config.concurrency ?? 3;
  }

  /**
   * Generate a CommunityReport for every community in `communities`.
   * Returns the reports in the same order as the input array.
   */
  async summarizeAll(communities: GraphCommunity[], graph: GraphStore): Promise<CommunityReport[]> {
    if (communities.length === 0) return [];

    const results: CommunityReport[] = [];
    // Process in batches respecting concurrency limit
    for (let i = 0; i < communities.length; i += this.concurrency) {
      const batch = communities.slice(i, i + this.concurrency);
      const batchResults = await Promise.all(
        batch.map((community) => this.summarizeCommunity(community, graph))
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async summarizeCommunity(
    community: GraphCommunity,
    graph: GraphStore
  ): Promise<CommunityReport> {
    const entities = community.entityIds
      .map((id) => graph.entities.get(id))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    const relDescriptions: string[] = [];

    for (const rel of graph.relationships.values()) {
      if (
        community.entityIds.includes(rel.sourceId) &&
        community.entityIds.includes(rel.targetId)
      ) {
        const src = graph.entities.get(rel.sourceId);
        const tgt = graph.entities.get(rel.targetId);
        if (src && tgt) {
          relDescriptions.push(
            `${src.name} ${rel.type} ${tgt.name}: ${rel.description} (weight: ${rel.weight})`
          );
        }
      }
    }

    const entityDescriptions = entities.map((e) => `- ${e.name} [${e.type}]: ${e.description}`);

    const prompt = this.buildSummaryPrompt('', entityDescriptions, relDescriptions);

    try {
      const raw = await this.llm(prompt);
      return this.parseReport(community.id, community.entityIds, raw);
    } catch {
      // Fallback: build a simple report without LLM
      return this.buildFallbackReport(
        community,
        entities.map((e) => e.name)
      );
    }
  }

  private buildSummaryPrompt(
    _communityId: string,
    entityDescriptions: string[],
    relDescriptions: string[]
  ): string {
    const relText =
      relDescriptions.length > 0
        ? relDescriptions.join('\n')
        : '(no intra-community relationships found)';

    return PromptRegistry.get<{ entityDescriptions: string; relDescriptions: string }>(
      COMMUNITY_SUMMARY_KEY
    ).render({
      entityDescriptions: entityDescriptions.join('\n'),
      relDescriptions: relText,
    });
  }

  private parseReport(communityId: string, entityIds: string[], raw: string): CommunityReport {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in community summary response');
      parsed = JSON.parse(match[0]);
    }

    const obj = parsed as Record<string, unknown>;

    return {
      communityId,
      title: String(obj.title ?? 'Untitled Community'),
      summary: String(obj.summary ?? ''),
      findings: Array.isArray(obj.findings) ? (obj.findings as unknown[]).map(String) : [],
      rating: Math.min(10, Math.max(1, Number(obj.rating) || 5)),
      entityIds,
    };
  }

  private buildFallbackReport(community: GraphCommunity, entityNames: string[]): CommunityReport {
    return {
      communityId: community.id,
      title: `Community: ${entityNames.slice(0, 3).join(', ')}${entityNames.length > 3 ? '...' : ''}`,
      summary: `This community contains ${entityNames.length} related entities: ${entityNames.join(', ')}.`,
      findings: entityNames.map((name) => `Contains entity: ${name}`),
      rating: 5,
      entityIds: community.entityIds,
    };
  }
}
