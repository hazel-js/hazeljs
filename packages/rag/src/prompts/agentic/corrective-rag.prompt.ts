import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const CORRECTIVE_RAG_KEY = 'rag:agentic:corrective-rag';

export interface CorrectiveRAGVariables {
  query: string;
  issues: string;
}

const template = new PromptTemplate<CorrectiveRAGVariables>(
  `The following retrieval results have issues. Suggest corrections:

Query: {query}
Issues: {issues}

Provide corrected query or strategy in JSON:
{
  "correctedQuery": "improved query",
  "strategy": "new strategy",
  "reasoning": "why this helps"
}`,
  {
    name: 'Corrective RAG',
    description: 'Prompts the LLM to suggest query/strategy corrections when results are poor',
    version: '1.0.0',
  }
);

PromptRegistry.register(CORRECTIVE_RAG_KEY, template);

export { template as correctiveRAGPrompt };
