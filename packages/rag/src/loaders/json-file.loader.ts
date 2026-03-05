/**
 * JSONFileLoader
 *
 * Loads a JSON file and converts it to documents.
 *
 * Supports two shapes:
 *  - **Array mode** (default) — if the root value is an array, each element
 *    becomes a document.  The element's text is either the value of `textKey`
 *    (a specific field) or the full JSON stringification of the element.
 *  - **Object mode** — a single root object becomes one document.
 *
 * @example
 * ```typescript
 * // articles.json = [{ "title": "...", "body": "..." }, ...]
 * const loader = new JSONFileLoader({
 *   path: './articles.json',
 *   textKey: 'body',       // use "body" field as content
 *   metadataKeys: ['title'], // include "title" in metadata
 * });
 * const docs = await loader.load();
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface JSONFileLoaderOptions {
  /** Path to the JSON file. */
  path: string;
  /**
   * Key in each array element (or root object) whose value becomes the
   * document content.  If omitted, the entire element is JSON-stringified.
   */
  textKey?: string;
  /**
   * Keys to extract from each element into the document metadata.
   * All other keys are omitted from metadata.
   */
  metadataKeys?: string[];
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
  /**
   * JSON pointer (dot-separated path) to the array within the JSON file.
   * @example 'data.results'  →  reads `json.data.results`
   */
  jsonPointer?: string;
}

@Loader({
  name: 'JSONFileLoader',
  description: 'Loads documents from a JSON file (array or object).',
  extensions: ['.json'],
  mimeTypes: ['application/json'],
})
export class JSONFileLoader extends BaseDocumentLoader {
  private readonly opts: Required<Omit<JSONFileLoaderOptions, 'textKey' | 'jsonPointer'>> & {
    textKey?: string;
    jsonPointer?: string;
  };

  constructor(options: JSONFileLoaderOptions) {
    super();
    this.opts = {
      path: options.path,
      textKey: options.textKey,
      metadataKeys: options.metadataKeys ?? [],
      metadata: options.metadata ?? {},
      jsonPointer: options.jsonPointer,
    };
  }

  async load(): Promise<Document[]> {
    const raw = await readFile(this.opts.path, { encoding: 'utf-8' });
    let parsed = JSON.parse(raw);

    // Navigate to a nested array via dot-separated pointer
    if (this.opts.jsonPointer) {
      for (const key of this.opts.jsonPointer.split('.')) {
        parsed = parsed[key];
        if (parsed === undefined) {
          throw new Error(
            `JSONFileLoader: key "${key}" not found at path "${this.opts.jsonPointer}" in ${this.opts.path}`
          );
        }
      }
    }

    const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    const fileName = basename(this.opts.path);

    return items.map((item, idx) => {
      const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<
        string,
        unknown
      >;

      // Build content
      let content: string;
      if (this.opts.textKey && this.opts.textKey in obj) {
        content = String(obj[this.opts.textKey]);
      } else {
        content = JSON.stringify(item, null, 2);
      }

      // Build metadata
      const metadata: Record<string, unknown> = {
        source: fileName,
        filePath: this.opts.path,
        index: idx,
        loaderType: 'json',
        ...this.opts.metadata,
      };
      for (const key of this.opts.metadataKeys) {
        if (key in obj) {
          metadata[key] = obj[key];
        }
      }

      return this.createDocument(content, metadata);
    });
  }
}
