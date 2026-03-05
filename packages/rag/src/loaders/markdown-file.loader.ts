/**
 * MarkdownFileLoader
 *
 * Loads Markdown files from disk.  Supports two modes:
 *
 *  - **single document** (default) — the entire file becomes one `Document`.
 *  - **split by heading** — splits the file at every `## ` (H2) heading,
 *    producing one document per section.  Each document's metadata includes
 *    the section heading.
 *
 * Front-matter (`---` blocks) is optionally parsed and stored in metadata.
 *
 * @example
 * ```typescript
 * const loader = new MarkdownFileLoader({
 *   path: './README.md',
 *   splitByHeading: 'h2',   // split on ##
 * });
 * const docs = await loader.load();
 * // docs[0].content === "# Introduction\n..."
 * // docs[0].metadata.heading === "Introduction"
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface MarkdownFileLoaderOptions {
  /** Path to the Markdown file. */
  path?: string;
  /** Multiple file paths. */
  paths?: string[];
  /**
   * Split on heading level.
   * `'h1'` → splits on `# `, `'h2'` → splits on `## `, etc.
   * @default undefined (no splitting — one document per file)
   */
  splitByHeading?: 'h1' | 'h2' | 'h3';
  /**
   * Strip YAML front-matter (`---` block) from content.
   * Front-matter keys are stored in document metadata.
   * @default true
   */
  parseFrontMatter?: boolean;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'MarkdownFileLoader',
  description: 'Loads Markdown files, optionally splitting by heading level.',
  extensions: ['.md', '.markdown', '.mdx'],
  mimeTypes: ['text/markdown'],
})
export class MarkdownFileLoader extends BaseDocumentLoader {
  private readonly paths: string[];
  private readonly splitByHeading?: 'h1' | 'h2' | 'h3';
  private readonly parseFrontMatter: boolean;
  private readonly extraMetadata: Record<string, unknown>;

  constructor(options: MarkdownFileLoaderOptions) {
    super();
    if (!options.path && (!options.paths || options.paths.length === 0)) {
      throw new Error('MarkdownFileLoader: provide at least one path via `path` or `paths`.');
    }
    this.paths = options.paths ?? (options.path ? [options.path] : []);
    this.splitByHeading = options.splitByHeading;
    this.parseFrontMatter = options.parseFrontMatter ?? true;
    this.extraMetadata = options.metadata ?? {};
  }

  async load(): Promise<Document[]> {
    const docs: Document[] = [];

    for (const filePath of this.paths) {
      const raw = await readFile(filePath, { encoding: 'utf-8' });
      const fileName = basename(filePath);
      const { content, frontMatter } = this.extractFrontMatter(raw);

      const baseMetadata: Record<string, unknown> = {
        source: fileName,
        filePath,
        loaderType: 'markdown',
        ...frontMatter,
        ...this.extraMetadata,
      };

      if (!this.splitByHeading) {
        docs.push(this.createDocument(content, baseMetadata));
      } else {
        const sections = this.splitOnHeading(content, this.splitByHeading);
        for (const section of sections) {
          if (section.text.trim()) {
            docs.push(this.createDocument(section.text, {
              ...baseMetadata,
              heading: section.heading,
            }));
          }
        }
      }
    }

    return docs;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private extractFrontMatter(text: string): {
    content: string;
    frontMatter: Record<string, unknown>;
  } {
    if (!this.parseFrontMatter) return { content: text, frontMatter: {} };

    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) return { content: text, frontMatter: {} };

    const frontMatterRaw = match[1];
    const content = text.slice(match[0].length);
    const frontMatter = this.parseYAMLLike(frontMatterRaw);
    return { content, frontMatter };
  }

  /**
   * Minimal YAML-like parser for simple key: value front-matter.
   * Does not support nested objects, arrays, or multi-line values.
   */
  private parseYAMLLike(raw: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const line of raw.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      result[key] = value;
    }
    return result;
  }

  private splitOnHeading(
    text: string,
    level: 'h1' | 'h2' | 'h3',
  ): Array<{ heading: string; text: string }> {
    const hashes = { h1: '#', h2: '##', h3: '###' }[level];
    const pattern = new RegExp(`^${hashes}\\s+(.+)$`, 'gm');
    const sections: Array<{ heading: string; text: string }> = [];

    let lastIndex = 0;
    let lastHeading = '';
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (lastIndex > 0 || lastHeading) {
        sections.push({
          heading: lastHeading,
          text: text.slice(lastIndex, match.index).trim(),
        });
      }
      lastHeading = match[1].trim();
      lastIndex = match.index;
    }

    // Push the final section
    if (lastHeading || lastIndex === 0) {
      sections.push({
        heading: lastHeading,
        text: text.slice(lastIndex).trim(),
      });
    }

    return sections;
  }
}
