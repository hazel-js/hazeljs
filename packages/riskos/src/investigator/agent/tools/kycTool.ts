/**
 * KYC tool - interface / in-memory placeholder
 */

export interface KycTool {
  getKycStatus(
    sessionId: string,
    tenantId?: string
  ): Promise<{ status: string; decision?: string }>;
}

export class MemoryKycTool implements KycTool {
  async getKycStatus(
    _sessionId: string,
    _tenantId?: string
  ): Promise<{ status: string; decision?: string }> {
    return { status: 'unknown', decision: 'PENDING' };
  }
}
