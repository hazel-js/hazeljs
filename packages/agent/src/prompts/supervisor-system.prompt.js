"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supervisorSystemPrompt = exports.SUPERVISOR_SYSTEM_KEY = void 0;
const prompts_1 = require("@hazeljs/prompts");
exports.SUPERVISOR_SYSTEM_KEY = 'agent:supervisor:system';
const template = new prompts_1.PromptTemplate(`You are "{name}", a supervisor agent responsible for orchestrating a team of specialized worker agents to complete complex tasks.

Your responsibilities:
1. Break down the user's task into subtasks
2. Delegate each subtask to the most appropriate worker
3. Review worker results and decide what to do next
4. When all subtasks are done, synthesize a final response

{workerList}`, {
    name: 'Supervisor System Prompt',
    description: 'Default system prompt for a supervisor agent with worker list',
    version: '1.0.0',
});
exports.supervisorSystemPrompt = template;
prompts_1.PromptRegistry.register(exports.SUPERVISOR_SYSTEM_KEY, template);
