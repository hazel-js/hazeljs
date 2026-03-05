import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const QUERY_REWRITER_KEY = 'rag:agentic:query-rewriter';

export interface QueryRewriterVariables {
  maxVariations: string;
  techniques: string;
  query: string;
}

const template = new PromptTemplate<QueryRewriterVariables>(
  `Generate {maxVariations} variations of this query using these techniques: {techniques}

Original Query: {query}

Generate {maxVariations} query variations (one per line):`,
  {
    name: 'Query Rewriter',
    description: 'Generates LLM-based query variations for improved retrieval coverage',
    version: '1.0.0',
  }
);

PromptRegistry.register(QUERY_REWRITER_KEY, template);

export { template as queryRewriterPrompt };
