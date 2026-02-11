/**
 * Risk history tool - interface / in-memory placeholder
 */

export interface RiskHistoryTool {
  getRiskHistory(entityId: string, tenantId?: string): Promise<Array<{ ts: string; score: number; reasons: string[] }>>;
}

export class MemoryRiskHistoryTool implements RiskHistoryTool {
  async getRiskHistory(entityId: string, _tenantId?: string): Promise<Array<{ ts: string; score: number; reasons: string[] }>> {
    return [
      { ts: new Date().toISOString(), score: 25, reasons: ['Placeholder'] },
    ];
  }
}
