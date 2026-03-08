/**
 * Prisma-backed memory store (PostgreSQL).
 * Import from '@hazeljs/memory/prisma' when you want DB persistence with Prisma.
 */

/** Minimal Prisma client shape for memory (avoids importing generated client in this file). */
export interface MemoryPrismaClient {
  memoryItem: {
    upsert(args: { where: { id: string }; create: object; update: object }): Promise<unknown>;
    findUnique(args: { where: { id: string } }): Promise<unknown>;
    findMany(args: { where?: object; orderBy?: object; take?: number; skip?: number }): Promise<unknown[]>;
    update(args: { where: { id: string }; data: object }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
    deleteMany(args: { where: object }): Promise<{ count: number }>;
    groupBy(args: { by: string[]; where?: object; _count?: object }): Promise<unknown[]>;
    aggregate(args: { where?: object; _min?: object; _max?: object }): Promise<{ _min: { updatedAt: Date | null }; _max: { updatedAt: Date | null } }>;
  };
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
import { MemoryCategory } from '../../types/category.types';
import { MemoryItem, MemorySource } from '../../types/memory-item.types';
import {
  MemoryQuery,
  MemorySearchOptions,
  MemoryStats,
  PruneOptions,
} from '../../types/store.types';
import { MemoryStore } from '../memory-store.interface';

export interface PrismaMemoryStoreOptions {
  /** Prisma client (with memory schema applied). */
  prisma: MemoryPrismaClient;
}

function parseValue(raw: unknown): MemoryItem['value'] {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw as number[];
  if (raw !== null && typeof raw === 'object') return raw as Record<string, unknown>;
  return raw as MemoryItem['value'];
}

function rowToItem(row: {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: unknown;
  confidence: number;
  source: string;
  evidence: unknown;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  accessCount: number;
  sessionId: string | null;
}): MemoryItem {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as MemoryCategory,
    key: row.key,
    value: parseValue(row.value),
    confidence: row.confidence,
    source: row.source as MemorySource,
    evidence: Array.isArray(row.evidence) ? (row.evidence as string[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt ?? undefined,
    accessCount: row.accessCount,
    sessionId: row.sessionId ?? undefined,
  };
}

/**
 * PostgreSQL-backed memory store using Prisma (same pattern as @hazeljs/flow).
 * Run migrations with: pnpm prisma migrate dev (from packages/memory).
 */
export class PrismaMemoryStore implements MemoryStore {
  constructor(private readonly prisma: MemoryPrismaClient) {}

  async initialize(): Promise<void> {
    await this.prisma.$connect();
  }

  async save(item: MemoryItem): Promise<string> {
    const valueJson = item.value;
    const evidenceJson = item.evidence ?? [];

    await this.prisma.memoryItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        userId: item.userId,
        category: item.category,
        key: item.key,
        value: valueJson as object,
        confidence: item.confidence,
        source: item.source,
        evidence: evidenceJson as object,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        expiresAt: item.expiresAt ?? null,
        accessCount: item.accessCount ?? 0,
        sessionId: item.sessionId ?? null,
      },
      update: {
        value: valueJson as object,
        confidence: item.confidence,
        evidence: evidenceJson as object,
        updatedAt: item.updatedAt,
        expiresAt: item.expiresAt ?? null,
        accessCount: item.accessCount ?? 0,
      },
    });
    return item.id;
  }

  async saveBatch(items: MemoryItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await this.save(item));
    }
    return ids;
  }

  async get(id: string): Promise<MemoryItem | null> {
    const row = await this.prisma.memoryItem.findUnique({
      where: { id },
    });
    if (!row) return null;
    const item = rowToItem(row as Parameters<typeof rowToItem>[0]);
    if (item.expiresAt && item.expiresAt.getTime() < Date.now()) {
      await this.delete(id);
      return null;
    }
    return item;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;

    const valueJson = updates.value ?? existing.value;
    const evidenceJson = updates.evidence ?? existing.evidence;

    await this.prisma.memoryItem.update({
      where: { id },
      data: {
        value: valueJson as object,
        confidence: updates.confidence ?? existing.confidence,
        source: updates.source ?? existing.source,
        evidence: evidenceJson as object,
        updatedAt: new Date(),
        expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : existing.expiresAt,
        accessCount: updates.accessCount ?? existing.accessCount,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.memoryItem.delete({ where: { id } }).catch(() => {});
  }

  async deleteBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.memoryItem.deleteMany({ where: { id: { in: ids } } });
  }

  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    const categories =
      options.category != null
        ? Array.isArray(options.category)
          ? options.category
          : [options.category]
        : Object.values(MemoryCategory);
    const sources =
      options.source != null
        ? Array.isArray(options.source)
          ? options.source
          : [options.source]
        : null;

    const where: Record<string, unknown> = {
      userId: options.userId,
      category: { in: categories },
    };
    if (sources) where.source = { in: sources };
    if (options.minConfidence != null) where.confidence = { gte: options.minConfidence };
    if (options.notExpired !== false) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    const orderBy = options.orderBy === 'createdAt' ? 'createdAt' : 'updatedAt';
    const rows = await this.prisma.memoryItem.findMany({
      where,
      orderBy: { [orderBy]: options.order ?? 'desc' },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    });

    return (rows as Parameters<typeof rowToItem>[0][]).map(rowToItem);
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const byCategory = Object.values(MemoryCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<MemoryCategory, number>
    );

    const where = userId
      ? {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        }
      : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

    const groups = await this.prisma.memoryItem.groupBy({
      by: ['category'],
      where,
      _count: { id: true },
    });
    for (const g of groups as Array<{ category: string; _count: { id: number } }>) {
      if (g.category in byCategory) byCategory[g.category as MemoryCategory] = g._count.id;
    }

    const agg = await this.prisma.memoryItem.aggregate({
      where,
      _min: { updatedAt: true },
      _max: { updatedAt: true },
    });
    const total = Object.values(byCategory).reduce((s, n) => s + n, 0);

    return {
      total,
      byCategory,
      oldestMemory: agg._min.updatedAt,
      newestMemory: agg._max.updatedAt,
    };
  }

  async prune(options?: PruneOptions): Promise<number> {
    const where: {
      expiresAt: { lt: Date };
      userId?: string;
      category?: string;
      updatedAt?: { lt: Date };
      confidence?: { lt: number };
    } = {
      expiresAt: { lt: new Date() },
    };
    if (options?.userId) where.userId = options.userId;
    if (options?.category) where.category = options.category;
    if (options?.olderThan) where.updatedAt = { lt: options.olderThan };
    if (options?.minConfidence != null) where.confidence = { lt: options.minConfidence };

    const result = await this.prisma.memoryItem.deleteMany({ where });
    return result.count;
  }
}
