/**
 * Evidence tool - interface / in-memory placeholder
 */

export interface EvidenceTool {
  getEvidence(requestId: string, tenantId?: string): Promise<{ traces: unknown[] }>;
}

export class MemoryEvidenceTool implements EvidenceTool {
  async getEvidence(requestId: string, _tenantId?: string): Promise<{ traces: unknown[] }> {
    return { traces: [] };
  }
}
