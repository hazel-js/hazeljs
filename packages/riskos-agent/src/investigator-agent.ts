/**
 * Investigator Agent - AI-powered compliance investigator.
 * Uses @Agent and @Tool decorators from @hazeljs/agent.
 */

import { Agent, Tool } from '@hazeljs/agent';
import type { InvestigatorAgentToolsConfig } from './types';

@Agent({
  name: 'investigator-agent',
  description: 'AI-powered compliance investigator for KYC, AML, and fraud cases',
  systemPrompt: `You are an expert compliance investigator assistant for banking and fintech.
Your role is to help analysts investigate cases by retrieving KYC status, evidence packs,
risk history, and transaction timelines. Always cite your sources and suggest relevant next actions.
When you use tools, explain what you found and how it relates to the investigation question.
Be concise but thorough. If data is not available, say so clearly.`,
  maxSteps: 15,
  temperature: 0.3,
  enableMemory: true,
  enableRAG: true,
  ragTopK: 5,
})
export class InvestigatorAgent {
  constructor(private tools: InvestigatorAgentToolsConfig) {}

  @Tool({
    name: 'get_kyc_status',
    description: 'Get KYC onboarding status and decision for a session',
    parameters: [
      {
        name: 'sessionId',
        type: 'string',
        description: 'The KYC session ID to lookup',
        required: true,
      },
      {
        name: 'tenantId',
        type: 'string',
        description: 'Optional tenant ID for multi-tenant contexts',
        required: false,
      },
    ],
  })
  async getKycStatus(input: { sessionId: string; tenantId?: string }) {
    return this.tools.kyc.getKycStatus(input.sessionId, input.tenantId);
  }

  @Tool({
    name: 'get_evidence',
    description: 'Retrieve audit traces and evidence for a request',
    parameters: [
      {
        name: 'requestId',
        type: 'string',
        description: 'The request ID to fetch evidence for',
        required: true,
      },
      {
        name: 'tenantId',
        type: 'string',
        description: 'Optional tenant ID',
        required: false,
      },
    ],
  })
  async getEvidence(input: { requestId: string; tenantId?: string }) {
    return this.tools.evidence.getEvidence(input.requestId, input.tenantId);
  }

  @Tool({
    name: 'get_risk_history',
    description: 'Get risk scoring history for an entity (customer, account, etc.)',
    parameters: [
      {
        name: 'entityId',
        type: 'string',
        description: 'The entity ID (e.g. customer ID, account ID)',
        required: true,
      },
      {
        name: 'tenantId',
        type: 'string',
        description: 'Optional tenant ID',
        required: false,
      },
    ],
  })
  async getRiskHistory(input: { entityId: string; tenantId?: string }) {
    return this.tools.riskHistory.getRiskHistory(input.entityId, input.tenantId);
  }

  @Tool({
    name: 'get_transaction_timeline',
    description: 'Get transaction timeline for a case',
    parameters: [
      {
        name: 'caseId',
        type: 'string',
        description: 'The case ID to get timeline for',
        required: true,
      },
      {
        name: 'tenantId',
        type: 'string',
        description: 'Optional tenant ID',
        required: false,
      },
    ],
  })
  async getTransactionTimeline(input: { caseId: string; tenantId?: string }) {
    return this.tools.transactionTimeline.getTimeline(input.caseId, input.tenantId);
  }
}
