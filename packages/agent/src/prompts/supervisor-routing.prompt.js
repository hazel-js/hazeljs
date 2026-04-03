"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supervisorRoutingPrompt = exports.SUPERVISOR_ROUTING_KEY = void 0;
const prompts_1 = require("@hazeljs/prompts");
exports.SUPERVISOR_ROUTING_KEY = 'agent:supervisor:routing';
const template = new prompts_1.PromptTemplate(`Original task: {originalTask}{contextSummary}

Decide the next action. Respond with ONLY a JSON object (no markdown):
{
  "action": "delegate" | "finish",
  "worker": "<worker name>",    // required when action === "delegate"
  "subtask": "<instructions>",  // required when action === "delegate"
  "response": "<final answer>", // required when action === "finish"
  "thought": "<your reasoning>" // optional
}`, {
    name: 'Supervisor Routing Decision',
    description: 'Prompts the supervisor LLM to decide whether to delegate or finish',
    version: '1.0.0',
});
exports.supervisorRoutingPrompt = template;
prompts_1.PromptRegistry.register(exports.SUPERVISOR_ROUTING_KEY, template);
