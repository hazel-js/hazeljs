/**
 * Setup helpers — production-shaped Gatekeeper bundle wiring.
 */

export { resolveAuditSink, type ResolveAuditSinkOptions } from './resolve-audit-sink';
export { tryCreateRedisApprovalProvider, type RedisApprovalFromEnvOptions } from './redis-from-env';
export {
  findApprovedHumanTaskToken,
  resolveLiveToolMethod,
  shortToolName,
  type HumanTaskLookup,
} from './human-task-resume';
export {
  bindGatekeeper,
  createAgentGatekeeperBundle,
  formatGatekeeperBootLine,
  gatekeeperFor,
  getBoundGatekeeper,
  type AgentGatekeeperBundle,
  type CreateAgentGatekeeperBundleOptions,
  type GatekeeperApprovalBackend,
  type HumanTaskServiceLike,
} from './create-gatekeeper-bundle';
export {
  resumeGatekeeperDecision,
  wireDemoHitlAutoApprove,
  type GatekeeperHitlDecision,
  type GatekeeperResumeRuntime,
  type WireDemoHitlAutoApproveOptions,
} from './resume-decision';
