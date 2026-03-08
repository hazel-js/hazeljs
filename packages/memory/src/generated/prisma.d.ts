/**
 * Stub types for Prisma client when the generated client is not yet built.
 * Run `pnpm prisma:generate` to generate the real client (then this file is shadowed by generated/prisma/).
 */
export class PrismaClient {
  memoryItem: {
    upsert(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
    deleteMany(args: unknown): Promise<{ count: number }>;
    groupBy(args: unknown): Promise<unknown[]>;
    aggregate(args: unknown): Promise<{ _min: { updatedAt: Date | null }; _max: { updatedAt: Date | null } }>;
  };
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
