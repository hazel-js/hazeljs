import type { DataSource, DataSink } from './connector.interface';

export interface PostgresSourceOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  /** Table name — must match /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/ */
  table: string;
  columns?: string[];
  /**
   * WHERE clause with $1,$2 placeholders. Use with `params`.
   * Example: where: 'status = $1 AND age > $2', params: ['active', 18]
   */
  where?: string;
  /** Bind parameters for the where clause */
  params?: unknown[];
  orderBy?: string;
  batchSize?: number;
  name?: string;
}

export interface PostgresSinkOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  table: string;
  columns: string[];
  conflictColumn?: string;
  batchSize?: number;
  name?: string;
}

/**
 * PostgreSQL data source — reads records from a Postgres table.
 * Requires 'pg' as peer dependency.
 *
 * @example
 * const source = new PostgresSource({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   user: 'user',
 *   password: 'pass',
 *   table: 'users',
 *   columns: ['id', 'name', 'email'],
 * });
 * await source.open();
 * const records = await source.readAll();
 * await source.close();
 */
interface PgPool {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface PgClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
}

function quoteIdent(ident: string): string {
  // Allow schema.table
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(ident)) {
    throw new Error(`Invalid SQL identifier: ${ident}`);
  }
  return ident
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
}

function quoteColumnList(columns: string[]): string {
  return columns
    .map((c) => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
        throw new Error(`Invalid column name: ${c}`);
      }
      return `"${c}"`;
    })
    .join(', ');
}

function sanitizeOrderBy(orderBy: string): string {
  // Allow: col, col ASC, col DESC, a, b DESC
  if (
    !/^[a-zA-Z_][a-zA-Z0-9_]*(\s+(ASC|DESC))?(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*(\s+(ASC|DESC))?)*$/i.test(
      orderBy.trim()
    )
  ) {
    throw new Error(`Invalid ORDER BY clause: ${orderBy}`);
  }
  return orderBy.trim();
}

export class PostgresSource implements DataSource<Record<string, unknown>> {
  readonly name: string;
  private readonly options: PostgresSourceOptions;
  private pool: PgPool | null = null;

  constructor(options: PostgresSourceOptions) {
    this.name = options.name ?? `postgres:${options.database}.${options.table}`;
    this.options = { batchSize: 1000, ...options };
    // Validate table early
    quoteIdent(this.options.table);
  }

  private async ensurePool(): Promise<void> {
    if (this.pool) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg');
      this.pool = new Pool({
        host: this.options.host,
        port: this.options.port,
        database: this.options.database,
        user: this.options.user,
        password: this.options.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } catch (error) {
      throw new Error(
        `PostgresSource requires 'pg' package. Install with: npm install pg\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async open(): Promise<void> {
    await this.ensurePool();
    if (!this.pool) throw new Error('Failed to initialize pool');
    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async readAll(): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    for await (const record of this.read()) {
      records.push(record);
    }
    return records;
  }

  async *read(): AsyncGenerator<Record<string, unknown>> {
    await this.ensurePool();
    if (!this.pool) throw new Error('Failed to initialize pool');

    const table = quoteIdent(this.options.table);
    const columns = this.options.columns ? quoteColumnList(this.options.columns) : '*';
    let query = `SELECT ${columns} FROM ${table}`;
    const params = this.options.params ?? [];

    if (this.options.where) {
      // where must use $N placeholders — never interpolate user values
      query += ` WHERE ${this.options.where}`;
    }

    if (this.options.orderBy) {
      query += ` ORDER BY ${sanitizeOrderBy(this.options.orderBy)}`;
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      for (const row of result.rows) {
        yield row as Record<string, unknown>;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Execute a custom SQL query
   */
  async query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
    await this.ensurePool();
    if (!this.pool) throw new Error('Failed to initialize pool');
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as Record<string, unknown>[];
    } finally {
      client.release();
    }
  }
}

/**
 * PostgreSQL data sink — writes records to a Postgres table.
 * Supports batch inserts and upserts.
 *
 * @example
 * const sink = new PostgresSink({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   user: 'user',
 *   password: 'pass',
 *   table: 'users',
 *   columns: ['id', 'name', 'email'],
 *   conflictColumn: 'id', // for upserts
 * });
 * await sink.open();
 * await sink.writeBatch(records);
 * await sink.close();
 */
export class PostgresSink implements DataSink<Record<string, unknown>> {
  readonly name: string;
  private readonly options: PostgresSinkOptions;
  private pool: PgPool | null = null;
  private buffer: Record<string, unknown>[] = [];

  constructor(options: PostgresSinkOptions) {
    this.name = options.name ?? `postgres:${options.database}.${options.table}`;
    this.options = { batchSize: 100, ...options };
    quoteIdent(this.options.table);
    quoteColumnList(this.options.columns);
  }

  private async ensurePool(): Promise<void> {
    if (this.pool) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg');
      this.pool = new Pool({
        host: this.options.host,
        port: this.options.port,
        database: this.options.database,
        user: this.options.user,
        password: this.options.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } catch (error) {
      throw new Error(
        `PostgresSink requires 'pg' package. Install with: npm install pg\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async open(): Promise<void> {
    await this.ensurePool();
  }

  async close(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flush();
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async write(record: Record<string, unknown>): Promise<void> {
    this.buffer.push(record);
    if (this.buffer.length >= (this.options.batchSize ?? 100)) {
      await this.flush();
    }
  }

  async writeBatch(records: Record<string, unknown>[]): Promise<void> {
    this.buffer.push(...records);
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (!this.pool) throw new Error('Pool not initialized');

    const client = await this.pool.connect();
    try {
      const columns = this.options.columns;
      const table = quoteIdent(this.options.table);
      const columnList = quoteColumnList(columns);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      if (this.options.conflictColumn) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.options.conflictColumn)) {
          throw new Error(`Invalid conflict column: ${this.options.conflictColumn}`);
        }
        const updates = columns
          .filter((c) => c !== this.options.conflictColumn)
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');

        const query = `
          INSERT INTO ${table} (${columnList})
          VALUES (${placeholders})
          ON CONFLICT ("${this.options.conflictColumn}")
          DO UPDATE SET ${updates}
        `;

        for (const record of this.buffer) {
          const values = columns.map((col) => record[col] ?? null);
          await client.query(query, values);
        }
      } else {
        const query = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`;

        for (const record of this.buffer) {
          const values = columns.map((col) => record[col] ?? null);
          await client.query(query, values);
        }
      }
    } finally {
      client.release();
    }

    this.buffer = [];
  }

  /**
   * Execute a custom SQL command
   */
  async execute(sql: string, params?: unknown[]): Promise<void> {
    await this.ensurePool();
    if (!this.pool) throw new Error('Failed to initialize pool');
    const client = await this.pool.connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  }
}
