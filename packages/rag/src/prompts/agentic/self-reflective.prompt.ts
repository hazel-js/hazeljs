import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const SELF_REFLECTIVE_KEY = 'rag:agentic:self-reflective';

export interface SelfReflectiveVariables {
  query: string;
  resultsStr: string;
}

const template = new PromptTemplate<SelfReflectiveVariables>(
  `Evaluate the quality of these search results for the given query.

Query: {query}

Results: {resultsStr}

Assess the following aspects (0-1 scale):
1. Relevance: How relevant are the results to the query?
2. Completeness: Do the results fully answer the query?
3. Accuracy: Are the results factually accurate?
4. Clarity: Are the results clear and well-structured?

Provide assessment in JSON format:
{
  "relevance": 0.0-1.0,
  "completeness": 0.0-1.0,
  "accuracy": 0.0-1.0,
  "clarity": 0.0-1.0,
  "issues": ["issue1", "issue2"]
}`,
  {
    name: 'Self-Reflective Quality Assessment',
    description: 'Evaluates retrieval quality across relevance, completeness, accuracy, and clarity',
    version: '1.0.0',
  }
);

PromptRegistry.register(SELF_REFLECTIVE_KEY, template);

export { template as selfReflectivePrompt };
