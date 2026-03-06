import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const RAG_ANSWER_KEY = 'rag:answer';

export interface RagAnswerVariables {
  context: string;
  query: string;
}

const template = new PromptTemplate<RagAnswerVariables>(
  `Based on the following context, answer the question.

Context:
{context}

Question: {query}

Answer:`,
  {
    name: 'RAG Answer',
    description: 'Generates an answer from retrieved context and a user question',
    version: '1.0.0',
  }
);

PromptRegistry.register(RAG_ANSWER_KEY, template);

export { template as ragAnswerPrompt };
