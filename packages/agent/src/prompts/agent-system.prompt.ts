import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const AGENT_SYSTEM_KEY = 'agent:system';

export interface AgentSystemVariables {
  systemPrompt: string;
  description: string;
  ragContext: string;
}

const template = new PromptTemplate<AgentSystemVariables>(
  `{systemPrompt}

Agent description: {description}

Relevant context:
{ragContext}`,
  {
    name: 'Agent System Prompt',
    description: 'Assembles the main system prompt for an agent from its config and RAG context',
    version: '1.0.0',
  }
);

PromptRegistry.register(AGENT_SYSTEM_KEY, template);

export { template as agentSystemPrompt };
