/**
 * KYC session store interface
 */

/** KYC session state */
export interface KycSession {
  id: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  answers: Record<string, unknown>;
  documents: Record<string, string>;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  checks: Record<string, { ok: boolean; match?: boolean; confidence?: number; issues?: string[] }>;
  decision?: { status: string; reasons: string[] };
}

/** KYC store interface - use MemoryKycStore (dev) or PgKycStore (prod) */
export interface KycStore {
  create(tenantId?: string): Promise<KycSession>;
  get(id: string): Promise<KycSession | null>;
  update(id: string, updates: Partial<KycSession>): Promise<KycSession | null>;
}
