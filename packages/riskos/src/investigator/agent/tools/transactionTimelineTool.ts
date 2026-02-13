/**
 * Transaction timeline tool - interface / in-memory placeholder
 */

export interface TransactionTimelineTool {
  getTimeline(
    caseId: string,
    tenantId?: string
  ): Promise<Array<{ ts: string; amount: number; desc: string }>>;
}

export class MemoryTransactionTimelineTool implements TransactionTimelineTool {
  async getTimeline(
    caseId: string,
    _tenantId?: string
  ): Promise<Array<{ ts: string; amount: number; desc: string }>> {
    return [
      { ts: new Date().toISOString(), amount: 0, desc: `Placeholder timeline for case ${caseId}` },
    ];
  }
}
