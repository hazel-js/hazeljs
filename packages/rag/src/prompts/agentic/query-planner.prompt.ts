import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const QUERY_PLANNER_KEY = 'rag:agentic:query-planner';

export interface QueryPlannerVariables {
  query: string;
}

const template = new PromptTemplate<QueryPlannerVariables>(
  `Decompose the following complex query into simpler sub-queries.
Each sub-query should be independent and focused on a specific aspect.

Query: {query}

Provide the decomposition in the following JSON format:
{
  "subQueries": [
    {
      "id": "1",
      "query": "sub-query text",
      "type": "factual|analytical|comparative|temporal",
      "dependencies": [],
      "priority": 1
    }
  ],
  "strategy": "sequential|parallel"
}`,
  {
    name: 'Query Planner',
    description: 'Decomposes complex queries into structured sub-queries for multi-step retrieval',
    version: '1.0.0',
  }
);

PromptRegistry.register(QUERY_PLANNER_KEY, template);

export { template as queryPlannerPrompt };
