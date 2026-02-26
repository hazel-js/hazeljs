/**
 * Adapters to wire RiskOS components to the Investigator Agent tools.
 */

import type {
  KycToolLike,
  EvidenceToolLike,
  RiskHistoryToolLike,
  TransactionTimelineToolLike,
} from './types';

/**
 * Create a KYC tool from a RiskOS KycStore.
 * Use MemoryKycStore or PgKycStore from @hazeljs/riskos.
 */
export function createKycToolFromStore(store: {
  get(id: string): Promise<{ decision?: { status?: string } } | null>;
}): KycToolLike {
  return {
    async getKycStatus(sessionId: string): Promise<{ status: string; decision?: string }> {
      const session = await store.get(sessionId);
      if (!session) return { status: 'not_found' };
      return {
        status: 'known',
        decision: session.decision?.status,
      };
    },
  };
}

/**
 * Create an evidence tool from a RiskOS AuditSink.
 */
export function createEvidenceToolFromAuditSink(sink: {
  buildEvidencePack(criteria: {
    requestId?: string;
    tenantId?: string;
  }): Promise<{ traces: unknown[] }>;
}): EvidenceToolLike {
  return {
    async getEvidence(requestId: string, tenantId?: string): Promise<{ traces: unknown[] }> {
      const pack = await sink.buildEvidencePack({ requestId, tenantId });
      return { traces: pack.traces };
    },
  };
}

/**
 * Placeholder risk history tool (replace with real DB-backed impl in production).
 */
export function createPlaceholderRiskHistoryTool(): RiskHistoryToolLike {
  return {
    async getRiskHistory(
      _entityId: string
    ): Promise<Array<{ ts: string; score: number; reasons: string[] }>> {
      return [{ ts: new Date().toISOString(), score: 0, reasons: ['No risk history available'] }];
    },
  };
}

/**
 * Placeholder transaction timeline tool (replace with real impl in production).
 */
export function createPlaceholderTransactionTimelineTool(): TransactionTimelineToolLike {
  return {
    async getTimeline(
      caseId: string
    ): Promise<Array<{ ts: string; amount: number; desc: string }>> {
      return [{ ts: new Date().toISOString(), amount: 0, desc: `Placeholder for case ${caseId}` }];
    },
  };
}
