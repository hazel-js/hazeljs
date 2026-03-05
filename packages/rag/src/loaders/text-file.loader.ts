/**
 * TextFileLoader
 *
 * Loads one or more plain-text files (.txt, .log, .tsv, etc.) from disk.
 * Each file becomes a single `Document`.
 *
 * @example
 * ```typescript
 * const loader = new TextFileLoader({ path: './docs/notes.txt' });
 * const docs = await loader.load();
 * // docs[0].content === "...file contents..."
 * // docs[0].metadata.source === "notes.txt"
 * ```
 *
 * Multiple files:
 * ```typescript
 * const loader = new TextFileLoader({ paths: ['./a.txt', './b.txt'] });
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface TextFileLoaderOptions {
  /** Single file path. */
  path?: string;
  /** Multiple file paths — documents are returned in the same order. */
  paths?: string[];
  /** File encoding. @default 'utf-8' */
  encoding?: BufferEncoding;
  /** Extra metadata merged into every document produced by this loader. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'TextFileLoader',
  description: 'Loads plain-text files from the local filesystem.',
  extensions: ['.txt', '.text', '.log', '.tsv', '.nfo'],
  mimeTypes: ['text/plain'],
})
export class TextFileLoader extends BaseDocumentLoader {
  private readonly paths: string[];
  private readonly encoding: BufferEncoding;
  private readonly extraMetadata: Record<string, unknown>;

  constructor(options: TextFileLoaderOptions) {
    super();
    if (!options.path && (!options.paths || options.paths.length === 0)) {
      throw new Error('TextFileLoader: provide at least one file path via `path` or `paths`.');
    }
    this.paths = options.paths ?? (options.path ? [options.path] : []);
    this.encoding = options.encoding ?? 'utf-8';
    this.extraMetadata = options.metadata ?? {};
  }

  async load(): Promise<Document[]> {
    const results: Document[] = [];

    for (const filePath of this.paths) {
      const content = await readFile(filePath, { encoding: this.encoding });
      results.push(
        this.createDocument(content, {
          source: basename(filePath),
          filePath,
          loaderType: 'text',
          ...this.extraMetadata,
        }),
      );
    }

    return results;
  }
}
