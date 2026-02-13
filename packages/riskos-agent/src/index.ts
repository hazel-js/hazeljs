/**
 * @hazeljs/riskos-agent
 * AI-powered Investigator Agent for RiskOS - KYC, AML, compliance
 */

export { InvestigatorAgent } from './investigator-agent';
export { createInvestigatorRuntime, runInvestigator } from './create-investigator-runtime';

export type {
  InvestigatorAgentToolsConfig,
  KycToolLike,
  EvidenceToolLike,
  RiskHistoryToolLike,
  TransactionTimelineToolLike,
  CreateInvestigatorRuntimeOptions,
} from './types';

export {
  createKycToolFromStore,
  createEvidenceToolFromAuditSink,
  createPlaceholderRiskHistoryTool,
  createPlaceholderTransactionTimelineTool,
} from './adapters';
