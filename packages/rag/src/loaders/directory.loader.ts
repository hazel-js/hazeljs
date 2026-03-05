/**
 * DirectoryLoader
 *
 * Walks a directory (optionally recursively) and loads every file whose
 * extension is matched by a registered loader or the `loaders` map.
 *
 * Supported patterns:
 *  1. **Extension map** (recommended) — pass a `loaders` map of
 *     `{ '.pdf': (path) => new PdfLoader({ path }) }` to customise which
 *     loader handles which extension.
 *  2. **Auto-detect** — falls back to the built-in file loaders for the
 *     common types (.txt, .md, .html, .json, .csv) with default options.
 *  3. **Glob filter** — pass `glob` to only load files matching a pattern.
 *
 * @example
 * ```typescript
 * const loader = new DirectoryLoader({
 *   path: './docs',
 *   recursive: true,
 *   loaders: {
 *     '.txt':  (p) => new TextFileLoader({ path: p }),
 *     '.md':   (p) => new MarkdownFileLoader({ path: p, splitByHeading: 'h2' }),
 *     '.pdf':  (p) => new PdfLoader({ path: p }),
 *   },
 * });
 * const docs = await loader.load();
 * ```
 */

import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';
import type { BaseDocumentLoader as IBaseDocumentLoader } from './base.loader';

export type LoaderFactory = (filePath: string) => IBaseDocumentLoader;

export interface DirectoryLoaderOptions {
  /** Root directory path to scan. */
  path: string;
  /**
   * Map of file extension → loader factory.
   * @example { '.txt': (p) => new TextFileLoader({ path: p }) }
   */
  loaders?: Record<string, LoaderFactory>;
  /** Recurse into sub-directories. @default true */
  recursive?: boolean;
  /**
   * Extensions to include.  If provided, only files with these extensions are
   * loaded (even if a loader is registered for other types).
   * @example ['.txt', '.md', '.pdf']
   */
  includeExtensions?: string[];
  /**
   * Extensions to exclude.
   * @example ['.DS_Store', '.gitkeep']
   */
  excludeExtensions?: string[];
  /** Maximum number of files to load (safety limit). @default 1000 */
  maxFiles?: number;
  /** Extra metadata merged into every document produced by this loader. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'DirectoryLoader',
  description: 'Walks a directory and loads all supported files using registered loaders.',
})
export class DirectoryLoader extends BaseDocumentLoader {
  private readonly opts: Required<DirectoryLoaderOptions>;

  constructor(options: DirectoryLoaderOptions) {
    super();
    this.opts = {
      path: options.path,
      loaders: options.loaders ?? {},
      recursive: options.recursive ?? true,
      includeExtensions: options.includeExtensions ?? [],
      excludeExtensions: options.excludeExtensions ?? [],
      maxFiles: options.maxFiles ?? 1000,
      metadata: options.metadata ?? {},
    };
  }

  async load(): Promise<Document[]> {
    const filePaths = await this.collectFiles(this.opts.path, 0);
    const allDocs: Document[] = [];

    for (const filePath of filePaths) {
      const loader = this.resolveLoader(filePath);
      if (!loader) continue;

      try {
        const docs = await loader.load();
        // Merge directory-level metadata into each document
        for (const doc of docs) {
          doc.metadata = {
            ...doc.metadata,
            directoryPath: this.opts.path,
            ...this.opts.metadata,
          };
          allDocs.push(doc);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[DirectoryLoader] Skipping ${basename(filePath)}: ${message}`);
      }

      if (allDocs.length >= this.opts.maxFiles) {
        console.warn(
          `[DirectoryLoader] maxFiles limit (${this.opts.maxFiles}) reached. ` +
          `Stopping early. Loaded ${allDocs.length} documents.`
        );
        break;
      }
    }

    return allDocs;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async collectFiles(dir: string, depth: number): Promise<string[]> {
    const entries = await readdir(dir);
    const files: string[] = [];

    for (const entry of entries) {
      // Skip hidden files/directories
      if (entry.startsWith('.')) continue;

      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        if (this.opts.recursive) {
          const subFiles = await this.collectFiles(fullPath, depth + 1);
          files.push(...subFiles);
        }
      } else {
        const ext = extname(entry).toLowerCase();

        if (this.opts.includeExtensions.length > 0 && !this.opts.includeExtensions.includes(ext)) {
          continue;
        }
        if (this.opts.excludeExtensions.includes(ext)) {
          continue;
        }

        files.push(fullPath);
      }
    }

    return files;
  }

  private resolveLoader(filePath: string): IBaseDocumentLoader | undefined {
    const ext = extname(filePath).toLowerCase();

    // 1. Check explicitly configured loaders first
    const factory = this.opts.loaders[ext];
    if (factory) return factory(filePath);

    // 2. Auto-detect using built-in loaders for common types
    return this.autoDetectLoader(filePath, ext);
  }

  private autoDetectLoader(
    filePath: string,
    ext: string,
  ): IBaseDocumentLoader | undefined {
    // Lazy imports to avoid loading all loaders when unused
    switch (ext) {
      case '.txt':
      case '.text':
      case '.log': {
        const { TextFileLoader } = require('./text-file.loader') as typeof import('./text-file.loader');
        return new TextFileLoader({ path: filePath });
      }
      case '.md':
      case '.markdown':
      case '.mdx': {
        const { MarkdownFileLoader } = require('./markdown-file.loader') as typeof import('./markdown-file.loader');
        return new MarkdownFileLoader({ path: filePath });
      }
      case '.json': {
        const { JSONFileLoader } = require('./json-file.loader') as typeof import('./json-file.loader');
        return new JSONFileLoader({ path: filePath });
      }
      case '.csv': {
        const { CSVFileLoader } = require('./csv-file.loader') as typeof import('./csv-file.loader');
        return new CSVFileLoader({ path: filePath });
      }
      case '.html':
      case '.htm': {
        const { HTMLFileLoader } = require('./html-file.loader') as typeof import('./html-file.loader');
        return new HTMLFileLoader({ path: filePath });
      }
      default:
        return undefined;
    }
  }
}
