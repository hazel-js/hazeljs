import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const GRAPH_SEARCH_KEY = 'rag:graph:search';

export interface GraphSearchVariables {
  modeHint: string;
  context: string;
  query: string;
}

const template = new PromptTemplate<GraphSearchVariables>(
  `You are a knowledge graph assistant. Answer the user's question using ONLY the provided context.
{modeHint}
If the context doesn't contain enough information, say so clearly.
Always be specific and cite entities or communities where relevant.

CONTEXT:
{context}

QUESTION: {query}

ANSWER:`,
  {
    name: 'Graph Search Synthesis',
    description: 'Synthesises a graph RAG answer using entity/community context',
    version: '1.0.0',
  }
);

PromptRegistry.register(GRAPH_SEARCH_KEY, template);

export { template as graphSearchPrompt };
