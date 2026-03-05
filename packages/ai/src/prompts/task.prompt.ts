import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

export const AI_TASK_FORMAT_KEY = 'ai:task:format';

export interface AITaskFormatVariables {
  taskName: string;
  description: string;
  input: string;
  inputExample: string;
  outputExample: string;
}

const template = new PromptTemplate<AITaskFormatVariables>(
  `{description}`,
  {
    name: 'AI Task Format',
    description:
      'Formats an AI task prompt by substituting context variables into the template string',
    version: '1.0.0',
  }
);

PromptRegistry.register(AI_TASK_FORMAT_KEY, template);

export { template as aiTaskFormatPrompt };
