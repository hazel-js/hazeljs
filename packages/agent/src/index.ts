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
export * from './decorators/approval.decorator';

export * from './registry/agent.registry';
export * from './registry/tool.registry';

export * from './state/agent.state';
export * from './state/agent-state.interface';
export * from './state/redis-state.manager';
export * from './state/database-state.manager';
export * from './state/create-state-manager';
export * from './state/redis-client.types';
export * from './state/emitting-state.manager';
export * from './approval/approval-store.interface';
export * from './approval/in-memory-approval.store';
export * from './approval/redis-approval.store';
export * from './approval/create-approval-store';
export * from './types/observability.types';
export * from './context/agent.context';

export * from './executor/agent.executor';
export * from './executor/tool.executor';
export * from './authorization/tool-authorization-gate.interface';
export * from './effects/tool-effect-gate.interface';

export * from './events/event.emitter';

export * from './runtime/agent.runtime';

export * from './loop/confidence-loop';
export * from './timeline/timeline.recorder';

// Agent OS Phase 2–4
export * from './timetravel/time-travel';
export * from './contracts/agent-contract';
export * from './policies/policy.engine';
export * from './recovery/recovery-ladder';
export * from './benchmark/benchmark';
export * from './skills/openapi-skills';
export * from './memory-graph/memory-graph';
export * from './evolution/agent-evolution';
export * from './cost/cost-optimizer';
export * from './simulator/agent-simulator';
export * from './twin/digital-twin';
export * from './dna/agent-dna';
export * from './dna/hot-reload';
export * from './dna/marketplace';
export * from './dna/bootstrap-from-dna';
export * from './dna/apply-dna-overlays';
export * from './llm/http-llm.provider';
export * from './store';
export * from './knowledge/knowledge-freshness';
export * from './memory-graph/graphrag-bridge';
export * from './timeline/timeline.store';
export * from './consensus/consensus';
export * from './governance/governance';

export * from './utils/rate-limiter';
export * from './utils/logger';
export * from './utils/metrics';
export * from './utils/retry';
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
export * from './a2a/a2a-task.store';
export { SqlA2ATaskStore } from './a2a/sql-a2a-task.store';

export { AgentModule, AgentService, GUARDRAILS_SERVICE_TOKEN } from './agent.module';

export * from './evaluation/agent-eval';

// Agent OS — durable run process (AOS-001+)
export * from './run';

// Agent OS Beta
export * from './identity/agent-identity';
export * from './policies/policy.service';
export * from './budget/run-budget';
export * from './scheduler/agent-scheduler';

// Agent OS Platform — declarative control plane (local-first)
export * from './platform';
