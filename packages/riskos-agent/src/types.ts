/**
 * Investigator agent tool interfaces.
 * Implement these or use RiskOS built-in implementations.
 */

export interface KycToolLike {
  getKycStatus(
    sessionId: string,
    tenantId?: string
  ): Promise<{ status: string; decision?: string }>;
}

export interface EvidenceToolLike {
  getEvidence(requestId: string, tenantId?: string): Promise<{ traces: unknown[] }>;
}

export interface RiskHistoryToolLike {
  getRiskHistory(
    entityId: string,
    tenantId?: string
  ): Promise<Array<{ ts: string; score: number; reasons: string[] }>>;
}

export interface TransactionTimelineToolLike {
  getTimeline(
    caseId: string,
    tenantId?: string
  ): Promise<Array<{ ts: string; amount: number; desc: string }>>;
}

export interface InvestigatorAgentToolsConfig {
  kyc: KycToolLike;
  evidence: EvidenceToolLike;
  riskHistory: RiskHistoryToolLike;
  transactionTimeline: TransactionTimelineToolLike;
}

export interface CreateInvestigatorRuntimeOptions {
  /** AI service for LLM (e.g. AIEnhancedService from @hazeljs/ai) */
  aiService: import('@hazeljs/agent').AIServiceAdapter;
  /** Tool implementations - use RiskOS MemoryKycTool etc. or your own */
  tools: InvestigatorAgentToolsConfig;
  /** Default model for the investigator (e.g. gpt-4, claude-3-opus) */
  model?: string;
  /** RAG service for case history / policy search (optional) */
  ragService?: unknown;
  /** Memory manager for conversation history (optional) */
  memoryManager?: unknown;
}
