"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentSystemPrompt = exports.AGENT_SYSTEM_KEY = void 0;
const prompts_1 = require("@hazeljs/prompts");
exports.AGENT_SYSTEM_KEY = 'agent:system';
const template = new prompts_1.PromptTemplate(`{systemPrompt}

Agent description: {description}

Relevant context:
{ragContext}`, {
    name: 'Agent System Prompt',
    description: 'Assembles the main system prompt for an agent from its config and RAG context',
    version: '1.0.0',
});
exports.agentSystemPrompt = template;
prompts_1.PromptRegistry.register(exports.AGENT_SYSTEM_KEY, template);
