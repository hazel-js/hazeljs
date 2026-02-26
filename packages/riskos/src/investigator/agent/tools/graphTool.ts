/**
 * Graph tool - interface / in-memory placeholder
 */

export interface GraphTool {
  getGraph(caseId: string, tenantId?: string): Promise<{ nodes: unknown[]; edges: unknown[] }>;
}

export class MemoryGraphTool implements GraphTool {
  async getGraph(
    caseId: string,
    _tenantId?: string
  ): Promise<{ nodes: unknown[]; edges: unknown[] }> {
    return {
      nodes: [{ id: caseId, type: 'placeholder' }],
      edges: [],
    };
  }
}
