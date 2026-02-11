/**
 * @hazeljs/riskos - Risk Operating System
 * KYC/KYB, fraud/AML scoring, investigator assistant, compliance, audit
 */

export { DataClassification, RiskLevel, DecisionStatus } from '@hazeljs/contracts';

// Config & types
export type { RiskOSConfig } from './config';
export type { CreateContextOptions } from './types';

// Core
export { RiskOSRuntime, createRiskOS, riskosPlugin } from './core/riskos';
export { RiskOSError, PolicyDeniedError, KycValidationError, ProviderError } from './core/errors';

// Bus
export type { EventBus, EventHandler } from './bus/eventBus';
export { NoopBus } from './bus/noopBus';
export { MemoryEventBus } from './bus/memoryBus';

// Audit
export type { AuditSink } from './audit/sink';
export type { ComplianceTrace } from './audit/trace';
export type { EvidencePack } from './audit/evidence/pack';
export { MemoryAuditSink } from './audit/sinks/memorySink';
export { PgAuditSink } from './audit/sinks/pgAuditSink';
export type { PgAuditSinkOptions } from './audit/sinks/pgAuditSink';

// Compliance
export { PolicyEngine } from './compliance/policyEngine';
export type { Policy, PolicyResult, PolicyOutcome } from './compliance/policyEngine';
export { requireTenant } from './compliance/policies/requireTenant';
export { requireAuthz } from './compliance/policies/requireAuthz';
export { denyCrossTenant } from './compliance/policies/denyCrossTenant';
export { requirePurpose } from './compliance/policies/requirePurpose';
export { piiRedaction } from './compliance/policies/piiRedaction';
export { modelAllowlist } from './compliance/policies/modelAllowlist';
export { requireSourcesForAI } from './compliance/policies/requireSourcesForAI';
export { approvalGate } from './compliance/policies/approvalGate';

// KYC
export { KycEngine, nextChatTurn } from './kyc/engine/kycEngine';
export type { KycFlowConfig, StepConfig } from './kyc/engine/kycEngine';
export type { KycStore, KycSession } from './kyc/store/store';
export { MemoryKycStore } from './kyc/store/memoryStore';
export { PgKycStore } from './kyc/store/pgKycStore';
export type { PgKycStoreOptions } from './kyc/store/pgKycStore';
export type { HttpProvider } from './kyc/providers/httpProvider';
export { MockHttpProvider } from './kyc/providers/mockHttpProvider';
export { FetchHttpProvider } from './kyc/providers/fetchHttpProvider';
export type { FetchHttpProviderOptions } from './kyc/providers/fetchHttpProvider';

// Risk scoring
export { evaluateRiskRuleset } from './risk/scoring/rulesEngine';
export type { RiskRuleset, ScoringOutput } from './risk/scoring/rulesEngine';

// Investigator
export { runInvestigatorAgent, formatResponseWithCitations } from './investigator/agent/investigatorAgent';
export type { InvestigatorInput } from './investigator/agent/investigatorAgent';
export type { InvestigatorResponse } from './investigator/contracts/response';

// Utils
export { get, set } from './utils/jsonpath';
export { resolveTemplate, resolveTemplateDeep } from './utils/template';
export { redactPii, redactPiiDeep } from './utils/redact';
