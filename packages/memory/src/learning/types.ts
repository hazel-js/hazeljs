/**
 * Governed learning memory types.
 * Application-level learning — not foundation-model training.
 */

export type MemoryLifecycleStatus =
  | 'candidate'
  | 'accepted'
  | 'quarantined'
  | 'rejected'
  | 'forgotten'
  | 'superseded';

export type GovernedMemoryType = 'fact' | 'preference' | 'procedure';

export type MemorySensitivity = 'public' | 'normal' | 'sensitive' | 'secret';

export interface MemoryProvenance {
  sourceKind: 'user' | 'tool' | 'model' | 'system' | 'feedback';
  sourceId?: string;
  actorId?: string;
  runId?: string;
  note?: string;
}

export interface GovernedMemoryRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  scope: string;
  type: GovernedMemoryType;
  content: string | null;
  provenance: MemoryProvenance;
  sourceTrust: number;
  factConfidence?: number;
  extractionConfidence?: number;
  version: number;
  status: MemoryLifecycleStatus;
  sensitivity: MemorySensitivity;
  expiresAt?: Date | null;
  lineageIds: string[];
  sourceId?: string | null;
  supersededBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
}

export interface CaptureMemoryInput {
  tenantId: string;
  subjectId: string;
  scope: string;
  type: GovernedMemoryType;
  content: string;
  provenance: MemoryProvenance;
  sourceTrust: number;
  factConfidence?: number;
  extractionConfidence?: number;
  sensitivity?: MemorySensitivity;
  expiresAt?: Date;
  lineageIds?: string[];
  sourceId?: string;
  /** Initial status. Default candidate. */
  status?: MemoryLifecycleStatus;
}

export interface MemoryAuthContext {
  tenantId: string;
  actorId: string;
  /** Scopes the actor may read. */
  allowedScopes: readonly string[];
}

export interface RetrieveMemoryQuery {
  auth: MemoryAuthContext;
  subjectId?: string;
  scope?: string;
  type?: GovernedMemoryType;
  text?: string;
  limit?: number;
  tokenBudget?: number;
}

export type MemoryHookName = 'capture' | 'extract' | 'consolidate' | 'persist' | 'retrieve';

export interface MemoryHookContext {
  name: MemoryHookName;
  record?: GovernedMemoryRecord;
  query?: RetrieveMemoryQuery;
  auth?: MemoryAuthContext;
}

export type MemoryHookResult =
  | { action: 'continue' }
  | { action: 'reject'; reason: string }
  | { action: 'transform'; record: GovernedMemoryRecord };

export type MemoryHook = (ctx: MemoryHookContext) => Promise<MemoryHookResult> | MemoryHookResult;

export interface GovernedMemoryHooks {
  capture?: MemoryHook[];
  extract?: MemoryHook[];
  consolidate?: MemoryHook[];
  persist?: MemoryHook[];
  retrieve?: MemoryHook[];
  /** Privacy-critical hooks fail closed on error. Default true for capture/persist/retrieve. */
  failClosed?: boolean;
}

export interface RetrievalCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix?(prefix: string): Promise<void>;
}
