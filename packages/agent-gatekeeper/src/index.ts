/**
 * @hazeljs/agent-gatekeeper
 *
 * Runtime authorization and policy-enforcement layer for HazelJS agent tool invocations.
 * Every tool call authorized before execution.
 */

export { AgentGatekeeper } from './gatekeeper';
export {
  GatekeeperError,
  GatekeeperDeniedError,
  GatekeeperApprovalRequiredError,
  GatekeeperValidationError,
  GatekeeperPolicyError,
  GatekeeperConfigurationError,
  GatekeeperExecutionError,
  GatekeeperErrorCodes,
} from './errors';
export type { GatekeeperErrorCode, GatekeeperErrorDetails } from './errors';

export type {
  ToolInvocationContext,
  GatekeeperDecision,
  AgentGatekeeperPolicy,
  AgentGatekeeperOptions,
  ProtectedTool,
  GatekeeperMode,
  DefaultDecision,
  ToolClassification,
  ToolRiskLevel,
  ApprovalRequest,
  ApprovalStatus,
  GatekeeperExecuteInput,
  GatekeeperExecuteResult,
  GatekeeperSimulation,
  PolicyEvaluationContext,
  ToolExecutorGateInput,
  ToolExecutorGateResult,
  TimeWindow,
} from './types';

export {
  InMemoryApprovalProvider,
  buildApprovalRequest,
  createApprovalStoreProvider,
  createHumanTaskProvider,
  type ApprovalProvider,
} from './approval/provider';
export {
  createRedisApprovalProvider,
  type RedisApprovalCommands,
  type RedisApprovalProviderOptions,
} from './approval/redis';

export {
  ConsoleAuditSink,
  InMemoryAuditSink,
  CompositeAuditSink,
  FailingAuditSink,
  GatekeeperMetrics,
  sanitizeContextForAudit,
  decisionEventType,
  toHazelAuditEvent,
  createAuditTransportSink,
  createOtelAuditSink,
  type AuditSink,
  type GatekeeperAuditEvent,
  type GatekeeperAuditEventType,
  type HazelAuditEvent,
  type HazelAuditTransport,
  type OtelApiLike,
} from './audit/sink';

export { BudgetTracker } from './budget/tracker';

export { evaluatePolicies, buildArgumentSummary } from './policy/engine';
export {
  policiesFromPolicyRules,
  policiesFromDna,
  mergeDnaPolicies,
  type PolicyRuleLike,
} from './policy/bridge';
export {
  loadPoliciesFromYaml,
  loadPoliciesFromFileSync,
  parseYamlPolicies,
  validatePolicies,
  yamlEntryToPolicy,
  type YamlPolicyDocument,
  type YamlPolicyEntry,
} from './policy/yaml';

export {
  fromFunction,
  fromHazelTool,
  fromSkillgate,
  fromMcpTool,
  createToolExecutorGate,
  protectMcpInvoke,
  protectMcpRegistry,
  type ToolExecutorContextFactory,
  type CreateToolExecutorGateOptions,
  type McpRegistryLike,
  type ProtectMcpRegistryOptions,
} from './adapters';

export {
  safeClone,
  redactObject,
  stripFields,
  matchToolPattern,
  invocationFingerprint,
  canonicalJson,
  defaultClock,
  defaultIdGenerator,
  sanitizeErrorMessage,
  isForbiddenKey,
  redactValue,
} from './security';

export {
  resolveAuditSink,
  tryCreateRedisApprovalProvider,
  findApprovedHumanTaskToken,
  resolveLiveToolMethod,
  shortToolName,
  bindGatekeeper,
  createAgentGatekeeperBundle,
  formatGatekeeperBootLine,
  gatekeeperFor,
  getBoundGatekeeper,
  resumeGatekeeperDecision,
  wireDemoHitlAutoApprove,
  type ResolveAuditSinkOptions,
  type RedisApprovalFromEnvOptions,
  type HumanTaskLookup,
  type AgentGatekeeperBundle,
  type CreateAgentGatekeeperBundleOptions,
  type GatekeeperApprovalBackend,
  type HumanTaskServiceLike,
  type GatekeeperHitlDecision,
  type GatekeeperResumeRuntime,
  type WireDemoHitlAutoApproveOptions,
} from './setup';

/** Opt-in external runtime governance boundary (does not change Gatekeeper defaults). */
export {
  assertGovernedManifest,
  ExternalRuntimeUnavailableError,
  GovernedCapabilityError,
  StaleApprovalError,
  argumentDigest,
  MemoryDistributedLock,
  RedisDistributedLock,
  FakeRedisLockClient,
  MemoryToolAttemptLedger,
  RedisToolAttemptLedger,
  withGovernedApproval,
  MemoryGovernedRunStore,
  requestCancel,
  acknowledgeCancel,
  markUnknown,
  MemoryDelegationStore,
  MemoryBudgetCounter,
  DelegationService,
  LocalRuntimeAdapter,
  LOCAL_MANIFEST,
  createOpenAiAgentsRuntimeAdapter,
  createGovernedToolExecutor,
  createGovernedRuntime,
} from './governed';
export type {
  RuntimeCapabilityManifest,
  GovernedRunStatus,
  CancelState,
  TrustedCallerContext,
  GovernedToolRequest,
  ToolAttemptStatus,
  ToolAttemptRecord,
  DelegationGrant,
  GovernedRunRecord,
  DistributedLock,
  ToolAttemptLedger,
  GovernedApprovalRequest,
  GovernedRunStore,
  DelegationStore,
  SharedBudgetCounter,
  IssueDelegationInput,
  RuntimeAdapter,
  GovernedToolExecutorOptions,
  GovernedToolResult,
  GovernedRuntimeOptions,
  GovernedRuntime,
} from './governed';
