/**
 * Lightweight .env loader shared by ConfigService and Agent OS / hazeld.
 * Wraps dotenv — no Hazel DI required.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export interface LoadEnvFilesOptions {
  /** Project root (default: process.cwd()). */
  cwd?: string;
  /**
   * Relative or absolute .env path(s).
   * Default: ['.env']
   */
  envFilePath?: string | string[];
  /**
   * When true, overwrite keys already set in process.env.
   * Default false (dotenv default).
   */
  override?: boolean;
}

export interface LoadEnvFilesResult {
  /** Absolute paths that were loaded successfully. */
  loaded: string[];
  /** Merged KEY=VALUE map from parsed files (in load order). */
  parsed: Record<string, string>;
}

/**
 * Load `.env` file(s) into `process.env` via dotenv.
 */
export function loadEnvFiles(options: LoadEnvFilesOptions = {}): LoadEnvFilesResult {
  const cwd = options.cwd ?? process.cwd();
  const raw = options.envFilePath ?? '.env';
  const paths = Array.isArray(raw) ? raw : [raw];
  const override = options.override === true;
  const loaded: string[] = [];
  const parsed: Record<string, string> = {};

  for (const filePath of paths) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    if (!fs.existsSync(fullPath)) continue;
    const result = dotenv.config({ path: fullPath, override });
    if (result.error) continue;
    loaded.push(fullPath);
    if (result.parsed) {
      Object.assign(parsed, result.parsed);
    }
  }

  return { loaded, parsed };
}
