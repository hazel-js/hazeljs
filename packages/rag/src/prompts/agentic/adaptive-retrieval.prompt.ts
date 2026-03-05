import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const ADAPTIVE_RETRIEVAL_KEY = 'rag:agentic:adaptive-retrieval';

export interface AdaptiveRetrievalVariables {
  query: string;
}

const template = new PromptTemplate<AdaptiveRetrievalVariables>(
  `Select the best retrieval strategy for this query:

Query: {query}

Available strategies:
- similarity: Best for semantic similarity
- hybrid: Combines keyword and semantic search
- mmr: Maximizes diversity while maintaining relevance

Respond in JSON:
{
  "selectedStrategy": "similarity|hybrid|mmr",
  "reason": "explanation",
  "confidence": 0.0-1.0
}`,
  {
    name: 'Adaptive Retrieval Strategy Selection',
    description: 'Selects the optimal retrieval strategy based on query characteristics',
    version: '1.0.0',
  }
);

PromptRegistry.register(ADAPTIVE_RETRIEVAL_KEY, template);

export { template as adaptiveRetrievalPrompt };
