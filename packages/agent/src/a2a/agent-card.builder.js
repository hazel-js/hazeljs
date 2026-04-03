"use strict";
/**
 * A2A Agent Card Builder
 *
 * Generates an A2A-compliant AgentCard from HazelJS @Agent decorator metadata.
 * This enables automatic discovery of HazelJS agents by other A2A-compatible
 * systems (e.g., Google ADK, other agent frameworks).
 *
 * @example
 * ```ts
 * const card = buildAgentCard(runtime, {
 *   url: 'https://api.example.com/a2a',
 *   provider: { organization: 'Acme Corp' },
 * });
 * // Serve at /.well-known/agent.json
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAgentCard = buildAgentCard;
exports.buildSingleAgentCard = buildSingleAgentCard;
/**
 * Build an A2A AgentCard from a HazelJS AgentRuntime.
 *
 * Scans all registered agents and their tools, converting them into
 * A2A skills. Each agent becomes a skill, and its tools become
 * example capabilities listed in the skill description.
 */
function buildAgentCard(runtime, options) {
    const agentNames = runtime.getAgents();
    // Use the first agent's metadata for top-level card info,
    // or fall back to generic info
    const primaryMeta = agentNames.length > 0 ? runtime.getAgentMetadata(agentNames[0]) : undefined;
    const skills = agentNames.map((name) => {
        const meta = runtime.getAgentMetadata(name);
        const tools = runtime.getAgentTools(name);
        return agentToSkill(name, meta, tools);
    });
    return {
        name: primaryMeta?.name ?? 'HazelJS Agent',
        description: primaryMeta?.description ?? 'A HazelJS-powered AI agent',
        url: options.url,
        provider: options.provider,
        version: options.version ?? '1.0.0',
        documentationUrl: options.documentationUrl,
        capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: true,
            ...(options.capabilities ?? {}),
        },
        authentication: options.authentication,
        defaultInputModes: options.defaultInputModes ?? ['text'],
        defaultOutputModes: options.defaultOutputModes ?? ['text'],
        skills,
    };
}
/**
 * Build an A2A AgentCard for a single agent (when serving one agent per endpoint).
 */
function buildSingleAgentCard(agentMeta, tools, options) {
    const skill = agentToSkill(agentMeta.name, agentMeta, tools);
    return {
        name: agentMeta.name,
        description: agentMeta.description ?? `AI Agent: ${agentMeta.name}`,
        url: options.url,
        provider: options.provider,
        version: options.version ?? '1.0.0',
        documentationUrl: options.documentationUrl,
        capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: true,
            ...(options.capabilities ?? {}),
        },
        authentication: options.authentication,
        defaultInputModes: options.defaultInputModes ?? ['text'],
        defaultOutputModes: options.defaultOutputModes ?? ['text'],
        skills: [skill],
    };
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function agentToSkill(name, meta, tools) {
    const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
    const description = meta?.description
        ? tools.length > 0
            ? `${meta.description}\n\nAvailable tools:\n${toolDescriptions}`
            : meta.description
        : `Agent: ${name}`;
    return {
        id: name,
        name,
        description,
        tags: meta?.policies ?? [],
        examples: meta?.systemPrompt ? [meta.systemPrompt.slice(0, 200)] : [],
        inputModes: ['text'],
        outputModes: ['text'],
    };
}
