import { PromptTemplate } from '@hazeljs/prompts';
export declare const SUPERVISOR_ROUTING_KEY = "agent:supervisor:routing";
export interface SupervisorRoutingVariables {
    originalTask: string;
    contextSummary: string;
}
declare const template: PromptTemplate<SupervisorRoutingVariables>;
export { template as supervisorRoutingPrompt };
//# sourceMappingURL=supervisor-routing.prompt.d.ts.map