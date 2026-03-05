/**
 * EntityExtractor
 *
 * Uses an LLM to extract (entity, type, description) nodes and
 * (source, type, target, description, weight) relationship edges from raw text.
 *
 * The extractor:
 *  1. Splits the input into chunks of `chunkSize` characters.
 *  2. Sends each chunk to the LLM with a structured JSON extraction prompt.
 *  3. Parses and validates the JSON response.
 *  4. Deduplicates entities by normalized name (case-insensitive).
 *  5. Merges relationships that reference the same entity pair+type.
 *
 * LLM output contract — the model MUST return valid JSON matching:
 * {
 *   "entities": [{ "name": string, "type": EntityType, "description": string }],
 *   "relationships": [{ "source": string, "target": string, "type": RelType, "description": string, "weight": 1-10 }]
 * }
 */

import type { ExtractionResult, EntityType, RelationshipType } from './graph.types';

const ENTITY_TYPES: EntityType[] = [
  'CONCEPT',
  'TECHNOLOGY',
  'PERSON',
  'ORGANIZATION',
  'PROCESS',
  'FEATURE',
  'EVENT',
  'LOCATION',
  'OTHER',
];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'USES',
  'IMPLEMENTS',
  'CREATED_BY',
  'PART_OF',
  'DEPENDS_ON',
  'RELATED_TO',
  'EXTENDS',
  'CONFIGURES',
  'TRIGGERS',
  'PRODUCES',
  'REPLACES',
  'OTHER',
];

export interface EntityExtractorConfig {
  llm: (prompt: string) => Promise<string>;
  chunkSize?: number;
}

export class EntityExtractor {
  private readonly llm: (prompt: string) => Promise<string>;
  private readonly chunkSize: number;

  constructor(config: EntityExtractorConfig) {
    this.llm = config.llm;
    this.chunkSize = config.chunkSize ?? 2000;
  }

  /**
   * Extract entities and relationships from an array of text chunks.
   * Returns a merged ExtractionResult with deduplicated entities.
   */
  async extract(texts: string[], _sourceDocId: string): Promise<ExtractionResult> {
    const allResults: ExtractionResult[] = [];

    for (const text of texts) {
      // Further split if text exceeds chunkSize
      const segments = this.splitText(text, this.chunkSize);

      for (const segment of segments) {
        try {
          const result = await this.extractFromSegment(segment);
          allResults.push(result);
        } catch {
          // Silently skip unparseable LLM responses — the graph will still be
          // populated from other chunks.
        }
      }
    }

    return this.mergeResults(allResults);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async extractFromSegment(text: string): Promise<ExtractionResult> {
    const prompt = this.buildExtractionPrompt(text);
    const raw = await this.llm(prompt);
    return this.parseResponse(raw);
  }

  private buildExtractionPrompt(text: string): string {
    return `You are a knowledge graph extraction expert. Extract ALL entities and relationships from the text below.

ENTITY TYPES (use exactly these strings): ${ENTITY_TYPES.join(', ')}
RELATIONSHIP TYPES (use exactly these strings): ${RELATIONSHIP_TYPES.join(', ')}

Rules:
- Extract every meaningful named concept, technology, framework, person, organization, or process
- Use canonical names (e.g. "HazelJS" not "hazel js" or "hazel framework")
- Descriptions should be 1-2 sentences explaining the entity/relationship in context
- Relationship weight 1-10: 10 = fundamental/core, 1 = peripheral mention
- Every relationship source and target MUST be an entity you extracted
- Return ONLY valid JSON, no markdown, no explanation

TEXT:
"""
${text}
"""

Return this exact JSON structure:
{
  "entities": [
    { "name": "string", "type": "EntityType", "description": "string" }
  ],
  "relationships": [
    { "source": "entity name", "target": "entity name", "type": "RelType", "description": "string", "weight": 5 }
  ]
}`;
  }

  private parseResponse(raw: string): ExtractionResult {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object from the response using a regex
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in LLM response');
      parsed = JSON.parse(match[0]);
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).entities) ||
      !Array.isArray((parsed as Record<string, unknown>).relationships)
    ) {
      throw new Error('Invalid extraction response shape');
    }

    const raw_ = parsed as {
      entities: Array<{ name?: string; type?: string; description?: string }>;
      relationships: Array<{
        source?: string;
        target?: string;
        type?: string;
        description?: string;
        weight?: number;
      }>;
    };

    return {
      entities: raw_.entities
        .filter((e) => e.name && e.type && e.description)
        .map((e) => ({
          name: String(e.name).trim(),
          type: this.normalizeEntityType(String(e.type)),
          description: String(e.description).trim(),
        })),

      relationships: raw_.relationships
        .filter((r) => r.source && r.target && r.type && r.description)
        .map((r) => ({
          source: String(r.source).trim(),
          target: String(r.target).trim(),
          type: this.normalizeRelType(String(r.type)),
          description: String(r.description).trim(),
          weight: Math.min(10, Math.max(1, Number(r.weight) || 5)),
        })),
    };
  }

  private normalizeEntityType(raw: string): EntityType {
    const upper = raw.toUpperCase() as EntityType;
    return ENTITY_TYPES.includes(upper) ? upper : 'OTHER';
  }

  private normalizeRelType(raw: string): RelationshipType {
    const upper = raw.toUpperCase() as RelationshipType;
    return RELATIONSHIP_TYPES.includes(upper) ? upper : 'OTHER';
  }

  /**
   * Merge multiple extraction results, deduplicating entities by
   * normalized (lower-case, trimmed) name and combining descriptions.
   */
  private mergeResults(results: ExtractionResult[]): ExtractionResult {
    // Deduplicate entities
    const entityMap = new Map<string, { name: string; type: EntityType; description: string }>();

    for (const result of results) {
      for (const entity of result.entities) {
        const key = entity.name.toLowerCase().trim();
        const existing = entityMap.get(key);
        if (existing) {
          // Merge descriptions when they add new information
          if (!existing.description.includes(entity.description)) {
            existing.description = `${existing.description}. ${entity.description}`;
          }
        } else {
          entityMap.set(key, { ...entity });
        }
      }
    }

    // Build a canonical name map (normalized → canonical)
    const canonicalName = new Map<string, string>();
    for (const [key, entity] of entityMap.entries()) {
      canonicalName.set(key, entity.name);
    }

    // Deduplicate and normalise relationships
    const relMap = new Map<
      string,
      {
        source: string;
        target: string;
        type: RelationshipType;
        description: string;
        weight: number;
      }
    >();

    for (const result of results) {
      for (const rel of result.relationships) {
        const srcKey = rel.source.toLowerCase().trim();
        const tgtKey = rel.target.toLowerCase().trim();

        const srcCanon = canonicalName.get(srcKey) ?? rel.source;
        const tgtCanon = canonicalName.get(tgtKey) ?? rel.target;

        // Only keep relationships between known entities
        if (!canonicalName.has(srcKey) || !canonicalName.has(tgtKey)) continue;

        const relKey = `${srcCanon}::${tgtCanon}::${rel.type}`;
        const existing = relMap.get(relKey);
        if (existing) {
          existing.weight = Math.max(existing.weight, rel.weight);
          if (!existing.description.includes(rel.description)) {
            existing.description = `${existing.description}. ${rel.description}`;
          }
        } else {
          relMap.set(relKey, {
            source: srcCanon,
            target: tgtCanon,
            type: rel.type,
            description: rel.description,
            weight: rel.weight,
          });
        }
      }
    }

    return {
      entities: [...entityMap.values()],
      relationships: [...relMap.values()],
    };
  }

  private splitText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxLen, text.length);
      // Try to break at a paragraph boundary
      if (end < text.length) {
        const breakAt = text.lastIndexOf('\n\n', end);
        if (breakAt > start + maxLen * 0.5) end = breakAt + 2;
      }
      chunks.push(text.slice(start, end).trim());
      start = end;
    }

    return chunks.filter((c) => c.length > 0);
  }
}
