import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const COMMUNITY_SUMMARY_KEY = 'rag:graph:community-summary';

export interface CommunitySummaryVariables {
  entityDescriptions: string;
  relDescriptions: string;
}

const template = new PromptTemplate<CommunitySummaryVariables>(
  `You are a knowledge base analyst. Analyse the following cluster of related entities and relationships extracted from technical documentation, then write a structured community report.

ENTITIES IN THIS COMMUNITY:
{entityDescriptions}

RELATIONSHIPS IN THIS COMMUNITY:
{relDescriptions}

Write a community report as JSON with this exact structure:
{
  "title": "one-line theme title (max 10 words)",
  "summary": "2-4 paragraph narrative describing what this community is about, what the entities have in common, and how they relate to each other",
  "findings": ["finding 1", "finding 2", "finding 3"],
  "rating": 7
}

rating = 1-10 importance score (10 = core architecture / central concept, 1 = peripheral detail).
Return ONLY valid JSON, no markdown.`,
  {
    name: 'Community Summary',
    description: 'Generates a structured report for a knowledge graph community cluster',
    version: '1.0.0',
  }
);

PromptRegistry.register(COMMUNITY_SUMMARY_KEY, template);

export { template as communitySummaryPrompt };
