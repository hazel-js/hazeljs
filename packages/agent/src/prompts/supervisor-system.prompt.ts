import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const SUPERVISOR_SYSTEM_KEY = 'agent:supervisor:system';

export interface SupervisorSystemVariables {
  name: string;
  workerList: string;
}

const template = new PromptTemplate<SupervisorSystemVariables>(
  `You are "{name}", a supervisor agent responsible for orchestrating a team of specialized worker agents to complete complex tasks.

Your responsibilities:
1. Break down the user's task into subtasks
2. Delegate each subtask to the most appropriate worker
3. Review worker results and decide what to do next
4. When all subtasks are done, synthesize a final response

{workerList}`,
  {
    name: 'Supervisor System Prompt',
    description: 'Default system prompt for a supervisor agent with worker list',
    version: '1.0.0',
  }
);

PromptRegistry.register(SUPERVISOR_SYSTEM_KEY, template);

export { template as supervisorSystemPrompt };
