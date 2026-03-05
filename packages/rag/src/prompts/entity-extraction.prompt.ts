import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const ENTITY_EXTRACTION_KEY = 'rag:graph:entity-extraction';

export interface EntityExtractionVariables {
  text: string;
  entityTypes: string;
  relationshipTypes: string;
}

const template = new PromptTemplate<EntityExtractionVariables>(
  `You are a knowledge graph extraction expert. Extract ALL entities and relationships from the text below.

ENTITY TYPES (use exactly these strings): {entityTypes}
RELATIONSHIP TYPES (use exactly these strings): {relationshipTypes}

Rules:
- Extract every meaningful named concept, technology, framework, person, organization, or process
- Use canonical names (e.g. "HazelJS" not "hazel js" or "hazel framework")
- Descriptions should be 1-2 sentences explaining the entity/relationship in context
- Relationship weight 1-10: 10 = fundamental/core, 1 = peripheral mention
- Every relationship source and target MUST be an entity you extracted
- Return ONLY valid JSON, no markdown, no explanation

TEXT:
"""
{text}
"""

Return this exact JSON structure:
{
  "entities": [
    { "name": "string", "type": "EntityType", "description": "string" }
  ],
  "relationships": [
    { "source": "entity name", "target": "entity name", "type": "RelType", "description": "string", "weight": 5 }
  ]
}`,
  {
    name: 'Entity Extraction',
    description: 'Extracts entities and relationships from text for knowledge graph construction',
    version: '1.0.0',
  }
);

PromptRegistry.register(ENTITY_EXTRACTION_KEY, template);

export { template as entityExtractionPrompt };
