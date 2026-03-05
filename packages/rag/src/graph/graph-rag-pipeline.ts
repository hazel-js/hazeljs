/**
 * GraphRAGPipeline
 *
 * The main entry point for GraphRAG. Orchestrates:
 *  1. Entity/relationship extraction (EntityExtractor)
 *  2. Knowledge graph construction (GraphStore)
 *  3. Community detection (CommunityDetector — LPA)
 *  4. Community report generation (CommunitySummarizer)
 *  5. Local and global search with LLM synthesis
 *
 * Search modes:
 * ┌──────────────┬────────────────────────────────────────────────────────┐
 * │ LOCAL        │ Finds entities matching the query, traverses K hops of │
 * │              │ the graph, assembles entity+relationship context, then  │
 * │              │ synthesises an answer. Best for specific questions.     │
 * ├──────────────┼────────────────────────────────────────────────────────┤
 * │ GLOBAL       │ Searches community reports by keyword/relevance, ranks  │
 * │              │ them, assembles a map-reduce-style context, then        │
 * │              │ synthesises a holistic answer. Best for broad questions.│
 * ├──────────────┼────────────────────────────────────────────────────────┤
 * │ HYBRID       │ Runs both local and global, merges contexts, and asks   │
 * │              │ the LLM to produce a unified answer.                   │
 * └──────────────┴────────────────────────────────────────────────────────┘
 *
 * Quick start:
 *   const pipeline = new GraphRAGPipeline({ llm: async (p) => openai.chat(p) });
 *   await pipeline.build(documents);
 *   const result = await pipeline.search('What is HazelJS dependency injection?');
 */

import type { Document } from '../types';
import type {
  GraphRAGConfig,
  GraphBuildStats,
  GraphSearchOptions,
  GraphSearchResult,
  GraphSearchMode,
  GraphEntity,
  GraphRelationship,
  CommunityReport,
  GraphStats,
} from './graph.types';
import { GraphStore } from './knowledge-graph';
import { EntityExtractor } from './entity-extractor';
import { CommunityDetector } from './community-detector';
import { CommunitySummarizer } from './community-summarizer';

let entityCounter = 0;
let relCounter = 0;

function nextEntityId(): string {
  return `entity_${++entityCounter}_${Date.now()}`;
}
function nextRelId(): string {
  return `rel_${++relCounter}_${Date.now()}`;
}

export class GraphRAGPipeline {
  private readonly config: GraphRAGConfig;
  private readonly graph: GraphStore;
  private readonly extractor: EntityExtractor;
  private readonly communityDetector: CommunityDetector;
  private readonly communitySummarizer: CommunitySummarizer;

  constructor(config: GraphRAGConfig) {
    this.config = {
      extractionChunkSize: 2000,
      communityIterations: 10,
      generateCommunityReports: true,
      maxCommunitySize: 15,
      localSearchDepth: 2,
      localSearchTopK: 5,
      globalSearchTopK: 5,
      ...config,
    };

    this.graph = new GraphStore();

    this.extractor = new EntityExtractor({
      llm: config.llm,
      chunkSize: this.config.extractionChunkSize,
    });

    this.communityDetector = new CommunityDetector({
      maxIterations: this.config.communityIterations,
      maxCommunitySize: this.config.maxCommunitySize,
    });

    this.communitySummarizer = new CommunitySummarizer({
      llm: config.llm,
    });
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  /**
   * Build (or rebuild) the entire knowledge graph from an array of Documents.
   * Clears any existing graph state before building.
   */
  async build(documents: Document[]): Promise<GraphBuildStats> {
    this.graph.clear();
    entityCounter = 0;
    relCounter = 0;
    return this.addDocuments(documents);
  }

  /**
   * Incrementally add more documents to an existing graph.
   * New entities are merged with existing ones if names match.
   */
  async addDocuments(documents: Document[]): Promise<GraphBuildStats> {
    const start = Date.now();
    const totalEntitiesBefore = this.graph.entities.size;
    const totalRelsBefore = this.graph.relationships.size;

    // ── Step 1: Extract entities and relationships from all documents ────────
    for (const doc of documents) {
      const docId = doc.id ?? `doc_${Date.now()}`;
      const extraction = await this.extractor.extract([doc.content], docId);

      // ── Step 2: Add entities to the graph (merge duplicates) ───────────────
      const entityNameToId = new Map<string, string>();

      for (const extracted of extraction.entities) {
        // Check if entity already exists
        const existing = this.graph.findEntityByName(extracted.name);
        if (existing) {
          this.graph.mergeEntity(existing.id, {
            description: extracted.description,
            sourceDocIds: [docId],
          });
          entityNameToId.set(extracted.name.toLowerCase(), existing.id);
        } else {
          const entity = this.graph.addEntity({
            id: nextEntityId(),
            name: extracted.name,
            type: extracted.type,
            description: extracted.description,
            sourceDocIds: [docId],
          });
          entityNameToId.set(extracted.name.toLowerCase(), entity.id);
        }
      }

      // ── Step 3: Add relationships ──────────────────────────────────────────
      for (const rel of extraction.relationships) {
        const sourceId = entityNameToId.get(rel.source.toLowerCase());
        const targetId = entityNameToId.get(rel.target.toLowerCase());

        if (!sourceId || !targetId) continue;

        this.graph.addRelationship({
          id: nextRelId(),
          sourceId,
          targetId,
          type: rel.type,
          description: rel.description,
          weight: rel.weight,
          sourceDocIds: [docId],
        });
      }
    }

    const entitiesExtracted = this.graph.entities.size - totalEntitiesBefore;
    const entitiesMerged = documents.length * 2; // rough heuristic
    const relsExtracted = this.graph.relationships.size - totalRelsBefore;

    // ── Step 4: Community detection ───────────────────────────────────────────
    const communities = this.communityDetector.detect(this.graph);
    this.graph.setCommunities(communities);

    // ── Step 5: Community report generation ───────────────────────────────────
    let reportsGenerated = 0;
    if (this.config.generateCommunityReports) {
      const reports = await this.communitySummarizer.summarizeAll(communities, this.graph);
      for (const report of reports) {
        this.graph.addCommunityReport(report);
      }
      reportsGenerated = reports.length;
    }

    return {
      documentsProcessed: documents.length,
      entitiesExtracted,
      entitiesMerged,
      relationshipsExtracted: relsExtracted,
      communitiesDetected: communities.length,
      communityReportsGenerated: reportsGenerated,
      duration: Date.now() - start,
    };
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /** Unified search entry point. Defaults to 'hybrid' mode. */
  async search(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const mode: GraphSearchMode = options.mode ?? 'hybrid';

    switch (mode) {
      case 'local':
        return this.localSearch(query, options);
      case 'global':
        return this.globalSearch(query, options);
      case 'hybrid':
      default:
        return this.hybridSearch(query, options);
    }
  }

  // ── Local Search ──────────────────────────────────────────────────────────

  /**
   * Entity-centric local search.
   * 1. Find entities whose names match the query keywords.
   * 2. Traverse up to `depth` hops in the knowledge graph.
   * 3. Assemble entity + relationship context.
   * 4. Synthesise an answer with the LLM.
   */
  async localSearch(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const start = Date.now();
    const depth = options.depth ?? this.config.localSearchDepth ?? 2;
    const topK = options.topK ?? this.config.localSearchTopK ?? 5;

    // Seed entities matching the query
    const seedEntities = this.findSeedEntities(query, topK);
    const seedIds = seedEntities.map((e) => e.id);

    // BFS traversal
    const { entities, relationships } = this.graph.bfsNeighbours(seedIds, depth);

    const context = this.buildLocalContext(query, entities, relationships);
    const answer = await this.synthesise(query, context, 'local');

    return {
      mode: 'local',
      query,
      answer,
      entities: options.includeGraph !== false ? entities : [],
      relationships: options.includeGraph !== false ? relationships : [],
      communities: [],
      context,
      duration: Date.now() - start,
    };
  }

  // ── Global Search ─────────────────────────────────────────────────────────

  /**
   * Community-report global search.
   * 1. Score community reports by query relevance (keyword overlap + rating).
   * 2. Assemble the top-K report summaries as context.
   * 3. Synthesise a holistic answer.
   */
  async globalSearch(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const start = Date.now();
    const topK = options.topK ?? this.config.globalSearchTopK ?? 5;

    const rankedReports = this.rankCommunityReports(query, topK);
    const context = this.buildGlobalContext(query, rankedReports);
    const answer = await this.synthesise(query, context, 'global');

    // Collect entities referenced in top communities
    const entityIds = new Set<string>();
    for (const report of rankedReports) {
      for (const id of report.entityIds) entityIds.add(id);
    }
    const entities = [...entityIds]
      .map((id) => this.graph.entities.get(id))
      .filter((e): e is GraphEntity => e !== undefined);

    return {
      mode: 'global',
      query,
      answer,
      entities: options.includeGraph !== false ? entities : [],
      relationships: [],
      communities: options.includeCommunities !== false ? rankedReports : [],
      context,
      duration: Date.now() - start,
    };
  }

  // ── Hybrid Search ─────────────────────────────────────────────────────────

  /**
   * Combines local and global search.
   * Both searches run in parallel; their contexts are merged before the final
   * LLM synthesis call, giving the best of both modes.
   */
  async hybridSearch(query: string, options: GraphSearchOptions = {}): Promise<GraphSearchResult> {
    const start = Date.now();

    const [local, global_] = await Promise.all([
      this.localSearch(query, { ...options, mode: 'local' }),
      this.globalSearch(query, { ...options, mode: 'global' }),
    ]);

    const mergedContext = [
      '=== LOCAL KNOWLEDGE GRAPH CONTEXT ===',
      local.context,
      '',
      '=== GLOBAL COMMUNITY CONTEXT ===',
      global_.context,
    ].join('\n');

    const answer = await this.synthesise(query, mergedContext, 'hybrid');

    const allEntityIds = new Set([
      ...local.entities.map((e) => e.id),
      ...global_.entities.map((e) => e.id),
    ]);
    const mergedEntities = [...allEntityIds]
      .map((id) => this.graph.entities.get(id))
      .filter((e): e is GraphEntity => e !== undefined);

    return {
      mode: 'hybrid',
      query,
      answer,
      entities: options.includeGraph !== false ? mergedEntities : [],
      relationships: options.includeGraph !== false ? local.relationships : [],
      communities: options.includeCommunities !== false ? global_.communities : [],
      context: mergedContext,
      duration: Date.now() - start,
    };
  }

  // ── Graph Access ──────────────────────────────────────────────────────────

  getGraph(): GraphStore {
    return this.graph;
  }

  getStats(): GraphStats {
    return this.graph.getStats();
  }

  clear(): void {
    this.graph.clear();
    entityCounter = 0;
    relCounter = 0;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private findSeedEntities(query: string, topK: number): GraphEntity[] {
    // Extract keywords from the query (simple tokenisation)
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scored = new Map<string, { entity: GraphEntity; score: number }>();

    for (const keyword of keywords) {
      const matches = this.graph.findEntitiesByName(keyword, 20);
      for (const entity of matches) {
        const existing = scored.get(entity.id);
        // Score: +2 for exact match, +1 for partial
        const isExact = entity.name.toLowerCase() === keyword;
        const delta = isExact ? 2 : 1;
        if (existing) {
          existing.score += delta;
        } else {
          scored.set(entity.id, { entity, score: delta });
        }
      }
    }

    return [...scored.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((v) => v.entity);
  }

  private rankCommunityReports(query: string, topK: number): CommunityReport[] {
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scored: Array<{ report: CommunityReport; score: number }> = [];

    for (const report of this.graph.communityReports.values()) {
      const text = `${report.title} ${report.summary} ${report.findings.join(' ')}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        // Count occurrences of each keyword
        const matches = (text.match(new RegExp(kw, 'g')) ?? []).length;
        score += matches;
      }
      // Boost by LLM importance rating
      score = score * (1 + report.rating / 10);
      scored.push({ report, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((v) => v.report);
  }

  private buildLocalContext(
    query: string,
    entities: GraphEntity[],
    relationships: GraphRelationship[]
  ): string {
    if (entities.length === 0) {
      return 'No relevant entities found in the knowledge graph for this query.';
    }

    const entitySection = entities
      .map((e) => `• ${e.name} [${e.type}]: ${e.description}`)
      .join('\n');

    const relSection = relationships
      .map((r) => {
        const src = this.graph.entities.get(r.sourceId)?.name ?? r.sourceId;
        const tgt = this.graph.entities.get(r.targetId)?.name ?? r.targetId;
        return `  ${src} → [${r.type}] → ${tgt}: ${r.description}`;
      })
      .join('\n');

    return [
      `ENTITIES related to "${query}":`,
      entitySection,
      '',
      'RELATIONSHIPS:',
      relSection || '  (none found)',
    ].join('\n');
  }

  private buildGlobalContext(query: string, reports: CommunityReport[]): string {
    if (reports.length === 0) {
      return 'No community reports available. Please build the graph first using GraphRAGPipeline.build().';
    }

    return reports
      .map((r, i) => {
        const findings = r.findings.map((f) => `  - ${f}`).join('\n');
        return [
          `[Community ${i + 1}] ${r.title} (importance: ${r.rating}/10)`,
          r.summary,
          'Key findings:',
          findings,
        ].join('\n');
      })
      .join('\n\n---\n\n');
  }

  private async synthesise(query: string, context: string, mode: GraphSearchMode): Promise<string> {
    const modeHint: Record<GraphSearchMode, string> = {
      local: 'Use the entity and relationship graph context to give a precise, specific answer.',
      global:
        'Use the community summaries to give a broad, thematic answer covering the full scope.',
      hybrid:
        'Combine the specific entity details and the broad community themes for a comprehensive answer.',
    };

    const prompt = `You are a knowledge graph assistant. Answer the user's question using ONLY the provided context.
${modeHint[mode]}
If the context doesn't contain enough information, say so clearly.
Always be specific and cite entities or communities where relevant.

CONTEXT:
${context}

QUESTION: ${query}

ANSWER:`;

    return this.config.llm(prompt);
  }
}
