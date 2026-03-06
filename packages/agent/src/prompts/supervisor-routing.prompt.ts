import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const SUPERVISOR_ROUTING_KEY = 'agent:supervisor:routing';

export interface SupervisorRoutingVariables {
  originalTask: string;
  contextSummary: string;
}

const template = new PromptTemplate<SupervisorRoutingVariables>(
  `Original task: {originalTask}{contextSummary}

Decide the next action. Respond with ONLY a JSON object (no markdown):
{
  "action": "delegate" | "finish",
  "worker": "<worker name>",    // required when action === "delegate"
  "subtask": "<instructions>",  // required when action === "delegate"
  "response": "<final answer>", // required when action === "finish"
  "thought": "<your reasoning>" // optional
}`,
  {
    name: 'Supervisor Routing Decision',
    description: 'Prompts the supervisor LLM to decide whether to delegate or finish',
    version: '1.0.0',
  }
);

PromptRegistry.register(SUPERVISOR_ROUTING_KEY, template);

export { template as supervisorRoutingPrompt };
