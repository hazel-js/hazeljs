import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const SELF_REFLECTIVE_IMPROVE_KEY = 'rag:agentic:self-reflective-improve';

export interface SelfReflectiveImproveVariables {
  query: string;
  issues: string;
  resultsStr: string;
}

const template = new PromptTemplate<SelfReflectiveImproveVariables>(
  `The following search results have quality issues. Suggest an improved query or retrieval strategy.

Original Query: {query}
Quality Issues: {issues}
Current Results: {resultsStr}

Suggest improvements in JSON format:
{
  "improvedQuery": "better query",
  "strategy": "similarity|hybrid|mmr",
  "reasoning": "why this would be better"
}`,
  {
    name: 'Self-Reflective Improvement',
    description: 'Suggests query/strategy improvements based on quality assessment issues',
    version: '1.0.0',
  }
);

PromptRegistry.register(SELF_REFLECTIVE_IMPROVE_KEY, template);

export { template as selfReflectiveImprovePrompt };
