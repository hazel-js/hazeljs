import { PromptTemplate } from '@hazeljs/prompts';
export declare const SUPERVISOR_SYSTEM_KEY = 'agent:supervisor:system';
export interface SupervisorSystemVariables {
  name: string;
  workerList: string;
}
declare const template: PromptTemplate<SupervisorSystemVariables>;
export { template as supervisorSystemPrompt };
//# sourceMappingURL=supervisor-system.prompt.d.ts.map
