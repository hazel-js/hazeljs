/**
 * Offline Feature Store - Historical feature retrieval for training
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { FeatureValue, OfflineStoreConfig } from './feature.types';

export interface OfflineStore {
  write(values: FeatureValue[]): Promise<void>;
  read(
    entityIds: string[],
    featureNames: string[],
    startTime?: Date,
    endTime?: Date
  ): Promise<FeatureValue[]>;
  readPointInTime(
    entityIds: string[],
    featureNames: string[],
    timestamp: Date
  ): Promise<Record<string, Record<string, unknown>>>;
  close(): Promise<void>;
}

/**
 * File-based offline store - for development and small datasets
 */
export class FileOfflineStore implements OfflineStore {
  private filePath: string;
  private cache: FeatureValue[] = [];
  private loaded = false;

  constructor(config: NonNullable<OfflineStoreConfig['file']>) {
    this.filePath = config.path;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;

    if (existsSync(this.filePath)) {
      const content = readFileSync(this.filePath, 'utf-8');
      this.cache = content
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parsed = JSON.parse(line);
          return {
            ...parsed,
            timestamp: new Date(parsed.timestamp),
          };
        });
    }
    this.loaded = true;
  }

  async write(values: FeatureValue[]): Promise<void> {
    this.ensureLoaded();

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const lines = values.map((v) => JSON.stringify(v)).join('\n') + '\n';
    writeFileSync(this.filePath, lines, { flag: 'a' });
    this.cache.push(...values);
  }

  async read(
    entityIds: string[],
    featureNames: string[],
    startTime?: Date,
    endTime?: Date
  ): Promise<FeatureValue[]> {
    this.ensureLoaded();

    return this.cache.filter((v) => {
      const matchEntity = entityIds.includes(v.entityId);
      const matchFeature = featureNames.includes(v.featureName);
      const matchStart = !startTime || v.timestamp >= startTime;
      const matchEnd = !endTime || v.timestamp <= endTime;
      return matchEntity && matchFeature && matchStart && matchEnd;
    });
  }

  async readPointInTime(
    entityIds: string[],
    featureNames: string[],
    timestamp: Date
  ): Promise<Record<string, Record<string, unknown>>> {
    this.ensureLoaded();

    const result: Record<string, Record<string, unknown>> = {};

    for (const entityId of entityIds) {
      result[entityId] = {};
      for (const featureName of featureNames) {
        const matching = this.cache
          .filter(
            (v) =>
              v.entityId === entityId && v.featureName === featureName && v.timestamp <= timestamp
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (matching.length > 0) {
          result[entityId][featureName] = matching[0].value;
        }
      }
    }

    return result;
  }

  async close(): Promise<void> {
    this.cache = [];
    this.loaded = false;
  }
}

/**
 * Postgres offline store - for production use
 * Requires 'pg' as peer dependency
 */
export class PostgresOfflineStore implements OfflineStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  private config: NonNullable<OfflineStoreConfig['postgres']>;

  constructor(config: NonNullable<OfflineStoreConfig['postgres']>) {
    this.config = config;
  }

  private async ensurePool(): Promise<void> {
    if (this.pool) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg');
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
      });

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS hazel_features (
          entity_id TEXT NOT NULL,
          feature_name TEXT NOT NULL,
          value JSONB NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          version TEXT,
          PRIMARY KEY (entity_id, feature_name, timestamp)
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_hazel_features_entity_time 
        ON hazel_features (entity_id, timestamp DESC)
      `);
    } catch (error) {
      throw new Error(
        `PostgresOfflineStore requires 'pg' package. Install with: npm install pg\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async write(values: FeatureValue[]): Promise<void> {
    await this.ensurePool();

    const query = `
      INSERT INTO hazel_features (entity_id, feature_name, value, timestamp, version)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (entity_id, feature_name, timestamp) DO UPDATE
      SET value = EXCLUDED.value, version = EXCLUDED.version
    `;

    const client = await this.pool.connect();
    try {
      for (const v of values) {
        await client.query(query, [
          v.entityId,
          v.featureName,
          JSON.stringify(v.value),
          v.timestamp,
          v.version ?? null,
        ]);
      }
    } finally {
      client.release();
    }
  }

  async read(
    entityIds: string[],
    featureNames: string[],
    startTime?: Date,
    endTime?: Date
  ): Promise<FeatureValue[]> {
    await this.ensurePool();

    let query = `
      SELECT entity_id, feature_name, value, timestamp, version
      FROM hazel_features
      WHERE entity_id = ANY($1) AND feature_name = ANY($2)
    `;
    const params: unknown[] = [entityIds, featureNames];

    if (startTime) {
      query += ` AND timestamp >= $${params.length + 1}`;
      params.push(startTime);
    }
    if (endTime) {
      query += ` AND timestamp <= $${params.length + 1}`;
      params.push(endTime);
    }

    query += ` ORDER BY timestamp DESC`;

    const result = await this.pool.query(query, params);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.rows.map((row: any) => ({
      entityId: row.entity_id,
      featureName: row.feature_name,
      value: JSON.parse(row.value),
      timestamp: new Date(row.timestamp),
      version: row.version,
    }));
  }

  async readPointInTime(
    entityIds: string[],
    featureNames: string[],
    timestamp: Date
  ): Promise<Record<string, Record<string, unknown>>> {
    await this.ensurePool();

    const query = `
      SELECT DISTINCT ON (entity_id, feature_name)
        entity_id, feature_name, value
      FROM hazel_features
      WHERE entity_id = ANY($1) 
        AND feature_name = ANY($2)
        AND timestamp <= $3
      ORDER BY entity_id, feature_name, timestamp DESC
    `;

    const result = await this.pool.query(query, [entityIds, featureNames, timestamp]);

    const output: Record<string, Record<string, unknown>> = {};
    for (const entityId of entityIds) {
      output[entityId] = {};
    }

    for (const row of result.rows) {
      output[row.entity_id][row.feature_name] = JSON.parse(row.value);
    }

    return output;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export function createOfflineStore(config: OfflineStoreConfig): OfflineStore {
  if (config.type === 'postgres') {
    if (!config.postgres) {
      throw new Error('Postgres configuration is required for postgres offline store');
    }
    return new PostgresOfflineStore(config.postgres);
  }

  if (config.type === 'file') {
    if (!config.file) {
      throw new Error('File configuration is required for file offline store');
    }
    return new FileOfflineStore(config.file);
  }

  throw new Error(`Unsupported offline store type: ${config.type}`);
}
