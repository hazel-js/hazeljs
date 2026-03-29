/**
 * @hazeljs/agent
 * AI-native Agent Runtime for HazelJS
 */

export * from './types/agent.types';
export * from './types/tool.types';
export * from './types/event.types';
export * from './types/llm.types';
export * from './types/rag.types';
export * from './errors/agent.error';

export * from './decorators/agent.decorator';
export * from './decorators/tool.decorator';
export * from './decorators/delegate.decorator';

export * from './registry/agent.registry';
export * from './registry/tool.registry';

export * from './state/agent.state';
export * from './state/agent-state.interface';
export * from './state/redis-state.manager';
export * from './state/database-state.manager';
export * from './context/agent.context';

export * from './executor/agent.executor';
export * from './executor/tool.executor';

export * from './events/event.emitter';

export * from './runtime/agent.runtime';

export * from './utils/rate-limiter';
export * from './utils/logger';
export * from './utils/metrics';
export * from './utils/retry';
export * from './utils/circuit-breaker';
export * from './utils/health-check';

// Multi-agent orchestration
export * from './graph/agent-graph.types';
export * from './graph/agent-graph';
export * from './supervisor/supervisor';

// A2A Protocol (Agent-to-Agent)
export * from './a2a/a2a.types';
export { buildAgentCard, buildSingleAgentCard } from './a2a/agent-card.builder';
export type { AgentCardOptions } from './a2a/agent-card.builder';
export { A2AServer } from './a2a/a2a.server';
export type { A2AServerOptions } from './a2a/a2a.server';

export { AgentModule, AgentService, GUARDRAILS_SERVICE_TOKEN } from './agent.module';
