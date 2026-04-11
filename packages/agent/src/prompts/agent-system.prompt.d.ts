import { PromptTemplate } from '@hazeljs/prompts';
export declare const AGENT_SYSTEM_KEY = 'agent:system';
export interface AgentSystemVariables {
  systemPrompt: string;
  description: string;
  ragContext: string;
}
declare const template: PromptTemplate<AgentSystemVariables>;
export { template as agentSystemPrompt };
//# sourceMappingURL=agent-system.prompt.d.ts.map
