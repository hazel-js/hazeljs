import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const HYDE_KEY = 'rag:agentic:hyde';

export interface HyDEVariables {
  count: string;
  query: string;
}

const template = new PromptTemplate<HyDEVariables>(
  `Generate {count} hypothetical documents that would perfectly answer this query.
Each document should be detailed and comprehensive.

Query: {query}

Generate {count} hypothetical documents (one per line):`,
  {
    name: 'HyDE — Hypothetical Document Generation',
    description: 'Generates hypothetical documents for HyDE retrieval augmentation',
    version: '1.0.0',
  }
);

PromptRegistry.register(HYDE_KEY, template);

export { template as hydePrompt };
