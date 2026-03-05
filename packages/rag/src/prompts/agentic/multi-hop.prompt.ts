import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const MULTI_HOP_KEY = 'rag:agentic:multi-hop';
export const MULTI_HOP_SYNTHESIZE_KEY = 'rag:agentic:multi-hop-synthesize';

export interface MultiHopVariables {
  query: string;
  resultsStr: string;
}

export interface MultiHopSynthesizeVariables {
  originalQuery: string;
  hopsStr: string;
}

const reasoningTemplate = new PromptTemplate<MultiHopVariables>(
  `Analyze these search results and determine if we need more information.

Query: {query}
Results: {resultsStr}

Provide analysis in JSON:
{
  "reasoning": "what we learned from these results",
  "nextQuery": "follow-up query if needed, or null",
  "shouldStop": true/false
}`,
  {
    name: 'Multi-Hop Reasoning',
    description: 'Analyses retrieved results and determines if additional hops are needed',
    version: '1.0.0',
  }
);

const synthesizeTemplate = new PromptTemplate<MultiHopSynthesizeVariables>(
  `Synthesize a final answer from this multi-hop reasoning chain:

Original Query: {originalQuery}

Reasoning Chain:
{hopsStr}

Provide a comprehensive final answer:`,
  {
    name: 'Multi-Hop Synthesis',
    description: 'Synthesises a final answer from the full multi-hop reasoning chain',
    version: '1.0.0',
  }
);

PromptRegistry.register(MULTI_HOP_KEY, reasoningTemplate);
PromptRegistry.register(MULTI_HOP_SYNTHESIZE_KEY, synthesizeTemplate);

export { reasoningTemplate as multiHopPrompt, synthesizeTemplate as multiHopSynthesizePrompt };
