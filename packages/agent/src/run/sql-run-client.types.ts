/**
 * Minimal Prisma client surface for SQL-backed AgentRun stores (AOS-014).
 * Provider-agnostic: works with any Prisma SQL datasource (PostgreSQL, MySQL,
 * SQLite, SQL Server, etc.). Apps inject their generated PrismaClient.
 */

export interface PrismaDelegate {
  create: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<unknown>;
  findFirst?: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  update: (args: unknown) => Promise<unknown>;
  delete?: (args: unknown) => Promise<unknown>;
  deleteMany?: (args: unknown) => Promise<unknown>;
  upsert?: (args: unknown) => Promise<unknown>;
}

/**
 * Expected Prisma models (see prisma-schema.example.prisma Agent OS section):
 * - AgentRun → agentRun
 * - AgentRunCheckpoint → agentRunCheckpoint
 * - AgentHumanTask → agentHumanTask
 * - AgentA2ATask → agentA2ATask
 */
export interface PrismaAgentRunClientLike {
  agentRun: PrismaDelegate;
  agentRunCheckpoint: PrismaDelegate;
  agentHumanTask: PrismaDelegate;
  agentA2ATask: PrismaDelegate;
}
