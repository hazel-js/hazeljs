import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { PromptEntry, PromptStore } from './store.interface';

export interface FileStoreOptions {
  /**
   * Absolute path to a JSON file that stores all prompt entries.
   * The file is created (with parent directories) if it does not exist.
   * Default: `./prompts.json` relative to the current working directory.
   */
  filePath?: string;
  /**
   * When `true`, the JSON file is pretty-printed with 2-space indentation.
   * Useful for human-readable prompt files under version control.
   * Default: `true`.
   */
  pretty?: boolean;
}

type FileData = Record<string, PromptEntry>;

/**
 * FileStore
 *
 * Persists prompt entries to a single JSON file on disk.
 * Entries are keyed by `"key@version"` in the JSON object.
 * The file is read once on first access and written on every `set`/`delete`.
 *
 * Suitable for small-to-medium prompt libraries committed to a repository.
 *
 * @example
 * ```typescript
 * PromptRegistry.addStore(new FileStore({ filePath: './prompts/library.json' }));
 * await PromptRegistry.saveAll();
 * ```
 */
export class FileStore implements PromptStore {
  readonly name = 'file';

  private readonly filePath: string;
  private readonly pretty: boolean;
  private cache: FileData | null = null;

  constructor(options: FileStoreOptions = {}) {
    this.filePath = options.filePath ?? join(process.cwd(), 'prompts.json');
    this.pretty = options.pretty ?? true;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private compoundKey(key: string, version: string): string {
    return `${key}@${version}`;
  }

  private async read(): Promise<FileData> {
    if (this.cache !== null) return this.cache;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.cache = JSON.parse(raw) as FileData;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private async write(data: FileData): Promise<void> {
    this.cache = data;
    await mkdir(dirname(this.filePath), { recursive: true });
    const content = this.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeFile(this.filePath, content, 'utf8');
  }

  // ── PromptStore interface ─────────────────────────────────────────────────

  async get(key: string, version = 'latest'): Promise<PromptEntry | undefined> {
    const data = await this.read();
    return data[this.compoundKey(key, version)];
  }

  async set(entry: PromptEntry): Promise<void> {
    const data = await this.read();
    const version = entry.version || 'latest';
    data[this.compoundKey(entry.key, version)] = { ...entry, version };
    if (version !== 'latest') {
      data[this.compoundKey(entry.key, 'latest')] = { ...entry, version: 'latest' };
    }
    await this.write(data);
  }

  async delete(key: string, version?: string): Promise<void> {
    const data = await this.read();
    if (version) {
      delete data[this.compoundKey(key, version)];
    } else {
      for (const k of Object.keys(data)) {
        if (k.startsWith(`${key}@`)) delete data[k];
      }
    }
    await this.write(data);
  }

  async has(key: string, version = 'latest'): Promise<boolean> {
    const data = await this.read();
    return this.compoundKey(key, version) in data;
  }

  async keys(): Promise<string[]> {
    const data = await this.read();
    const seen = new Set<string>();
    for (const compKey of Object.keys(data)) {
      seen.add(compKey.split('@')[0]);
    }
    return [...seen];
  }

  async versions(key: string): Promise<string[]> {
    const data = await this.read();
    const vers: string[] = [];
    for (const compKey of Object.keys(data)) {
      const [k, v] = compKey.split('@');
      if (k === key && v !== 'latest') vers.push(v);
    }
    return vers.sort();
  }

  /** Invalidate the in-process file cache, forcing a re-read on next access. */
  invalidate(): void {
    this.cache = null;
  }
}
