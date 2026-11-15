/**
 * Prisma-backed GovernedMemoryStore for governed_memory_records.
 * Import via createPrismaGovernedMemoryStore from '@hazeljs/memory/prisma'.
 */

import type {
  GovernedMemoryRecord,
  MemoryAuthContext,
  MemoryLifecycleStatus,
  MemoryProvenance,
  MemorySensitivity,
  GovernedMemoryType,
  RetrieveMemoryQuery,
} from './types';
import type { GovernedMemoryStore } from './store';

/** Minimal Prisma client shape for governed memory (avoids hard import of generated client). */
export interface GovernedMemoryPrismaClient {
  governedMemoryRecord: {
    create(args: { data: object }): Promise<GovernedMemoryRow>;
    findUnique(args: { where: { id: string } }): Promise<GovernedMemoryRow | null>;
    findMany(args: {
      where?: object;
      orderBy?: object;
      take?: number;
    }): Promise<GovernedMemoryRow[]>;
    update(args: { where: { id: string }; data: object }): Promise<GovernedMemoryRow>;
    updateMany(args: { where: object; data: object }): Promise<{ count: number }>;
  };
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

export interface GovernedMemoryRow {
  id: string;
  tenantId: string;
  subjectId: string;
  scope: string;
  type: string;
  content: string | null;
  provenance: unknown;
  sourceTrust: number;
  factConfidence: number | null;
  extractionConfidence: number | null;
  version: number;
  status: string;
  sensitivity: string;
  expiresAt: Date | null;
  lineageIds: unknown;
  sourceId: string | null;
  supersededBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
}

export interface PrismaGovernedMemoryStoreOptions {
  prisma: GovernedMemoryPrismaClient;
}

function scopeAllowed(auth: MemoryAuthContext, scope: string): boolean {
  return auth.allowedScopes.includes('*') || auth.allowedScopes.includes(scope);
}

function rowToRecord(row: GovernedMemoryRow): GovernedMemoryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    subjectId: row.subjectId,
    scope: row.scope,
    type: row.type as GovernedMemoryType,
    content: row.content,
    provenance: (row.provenance ?? {}) as MemoryProvenance,
    sourceTrust: row.sourceTrust,
    factConfidence: row.factConfidence ?? undefined,
    extractionConfidence: row.extractionConfidence ?? undefined,
    version: row.version,
    status: row.status as MemoryLifecycleStatus,
    sensitivity: row.sensitivity as MemorySensitivity,
    expiresAt: row.expiresAt,
    lineageIds: Array.isArray(row.lineageIds) ? (row.lineageIds as string[]) : [],
    sourceId: row.sourceId,
    supersededBy: row.supersededBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    accessCount: row.accessCount,
  };
}

function recordToCreate(record: GovernedMemoryRecord): object {
  return {
    id: record.id,
    tenantId: record.tenantId,
    subjectId: record.subjectId,
    scope: record.scope,
    type: record.type,
    content: record.content,
    provenance: record.provenance as object,
    sourceTrust: record.sourceTrust,
    factConfidence: record.factConfidence ?? null,
    extractionConfidence: record.extractionConfidence ?? null,
    version: record.version,
    status: record.status,
    sensitivity: record.sensitivity,
    expiresAt: record.expiresAt ?? null,
    lineageIds: record.lineageIds as object,
    sourceId: record.sourceId ?? null,
    supersededBy: record.supersededBy ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    accessCount: record.accessCount,
  };
}

/**
 * PostgreSQL-backed store for governed learning memory.
 * Requires the GovernedMemoryRecord Prisma model / migration applied.
 */
export class PrismaGovernedMemoryStore implements GovernedMemoryStore {
  constructor(private readonly prisma: GovernedMemoryPrismaClient) {}

  async insert(record: GovernedMemoryRecord): Promise<GovernedMemoryRecord> {
    const row = await this.prisma.governedMemoryRecord.create({
      data: recordToCreate(record),
    });
    return rowToRecord(row);
  }

  async getById(id: string, auth: MemoryAuthContext): Promise<GovernedMemoryRecord | undefined> {
    const row = await this.prisma.governedMemoryRecord.findUnique({ where: { id } });
    if (!row) return undefined;
    if (row.tenantId !== auth.tenantId) return undefined;
    if (!scopeAllowed(auth, row.scope)) return undefined;
    return rowToRecord(row);
  }

  async compareAndSwap(
    id: string,
    expectedVersion: number,
    next: GovernedMemoryRecord
  ): Promise<GovernedMemoryRecord | undefined> {
    const updated = await this.prisma.governedMemoryRecord.updateMany({
      where: { id, version: expectedVersion },
      data: {
        tenantId: next.tenantId,
        subjectId: next.subjectId,
        scope: next.scope,
        type: next.type,
        content: next.content,
        provenance: next.provenance as object,
        sourceTrust: next.sourceTrust,
        factConfidence: next.factConfidence ?? null,
        extractionConfidence: next.extractionConfidence ?? null,
        version: expectedVersion + 1,
        status: next.status,
        sensitivity: next.sensitivity,
        expiresAt: next.expiresAt ?? null,
        lineageIds: next.lineageIds as object,
        sourceId: next.sourceId ?? null,
        supersededBy: next.supersededBy ?? null,
        updatedAt: new Date(),
        accessCount: next.accessCount,
      },
    });
    if (updated.count === 0) return undefined;
    const row = await this.prisma.governedMemoryRecord.findUnique({ where: { id } });
    return row ? rowToRecord(row) : undefined;
  }

  async query(query: RetrieveMemoryQuery): Promise<GovernedMemoryRecord[]> {
    const { auth } = query;
    const now = new Date();
    const rows = await this.prisma.governedMemoryRecord.findMany({
      where: {
        tenantId: auth.tenantId,
        status: 'accepted',
        supersededBy: null,
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.scope ? { scope: query.scope } : {}),
        ...(query.type ? { type: query.type } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: query.limit ?? 100,
    });

    return rows
      .filter((r) => scopeAllowed(auth, r.scope))
      .filter((r) => {
        if (!query.text) return true;
        const hay = (r.content ?? '').toLowerCase();
        return hay.includes(query.text.toLowerCase());
      })
      .map(rowToRecord);
  }

  async listBySourceId(tenantId: string, sourceId: string): Promise<GovernedMemoryRecord[]> {
    const rows = await this.prisma.governedMemoryRecord.findMany({
      where: { tenantId, sourceId },
    });
    return rows.map(rowToRecord);
  }

  async touch(id: string): Promise<void> {
    const row = await this.prisma.governedMemoryRecord.findUnique({ where: { id } });
    if (!row) return;
    await this.prisma.governedMemoryRecord.update({
      where: { id },
      data: { accessCount: row.accessCount + 1 },
    });
  }
}

export function createPrismaGovernedMemoryStore(
  prisma: GovernedMemoryPrismaClient
): PrismaGovernedMemoryStore {
  return new PrismaGovernedMemoryStore(prisma);
}
