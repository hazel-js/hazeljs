import type { PromptMetadata } from '../types';

/**
 * A serializable snapshot of one version of a registered prompt.
 * This is what gets persisted to / loaded from any store backend.
 */
export interface PromptEntry {
  /** Registry key (e.g. `rag:graph:entity-extraction`). */
  key: string;
  /**
   * Semantic version string (e.g. `1.0.0`).
   * Defaults to `'latest'` when `PromptMetadata.version` is not set.
   */
  version: string;
  /** Raw template string with `{variable}` placeholders. */
  template: string;
  /** Human-readable metadata. */
  metadata: PromptMetadata;
  /** ISO-8601 timestamp of when the entry was written to the store. */
  storedAt: string;
}

/**
 * PromptStore
 *
 * Async storage contract implemented by every backend.
 * All methods are async so implementations can use any I/O mechanism
 * (file system, Redis, SQL/NoSQL, HTTP, etc.) without blocking the event loop.
 *
 * Versioning semantics:
 * - Every entry is stored under a `(key, version)` pair.
 * - `version` defaults to `'latest'` when not supplied.
 * - `get(key)` returns the `'latest'` version.
 * - `get(key, '1.2.0')` returns a specific historical version.
 */
export interface PromptStore {
  /** Human-readable identifier shown in error messages and logs. */
  readonly name: string;

  /**
   * Retrieve the entry for `key` at `version` (defaults to `'latest'`).
   * Returns `undefined` when the entry does not exist.
   */
  get(key: string, version?: string): Promise<PromptEntry | undefined>;

  /**
   * Persist `entry` to the store.
   * If an entry with the same `(key, version)` already exists it is overwritten.
   */
  set(entry: PromptEntry): Promise<void>;

  /**
   * Remove the entry for `key` at `version`.
   * If `version` is omitted, ALL versions of the key are removed.
   */
  delete(key: string, version?: string): Promise<void>;

  /** Returns `true` when an entry for `key@version` exists. */
  has(key: string, version?: string): Promise<boolean>;

  /** Returns all distinct keys currently stored (deduplicated across versions). */
  keys(): Promise<string[]>;

  /**
   * Returns all stored version strings for a given key in ascending semver order.
   * Returns an empty array when the key does not exist.
   */
  versions(key: string): Promise<string[]>;
}
