/**
 * HTMLFileLoader
 *
 * Loads HTML files from disk and converts them to plain text.
 *
 * Uses a built-in tag stripper with no external dependencies.
 * For advanced HTML parsing (CSS selectors, JavaScript rendering), use
 * `WebLoader` with the optional `cheerio` dependency instead.
 *
 * Optionally strips:
 *  - `<script>` and `<style>` blocks (content + tags)
 *  - HTML comments
 *  - All remaining HTML tags (leaving only text nodes)
 *
 * @example
 * ```typescript
 * const loader = new HTMLFileLoader({ path: './page.html' });
 * const docs = await loader.load();
 * // docs[0].content === stripped plain text
 * // docs[0].metadata.title === page <title>
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface HTMLFileLoaderOptions {
  path?: string;
  paths?: string[];
  /**
   * CSS selector string used to limit extraction to a specific element.
   * Requires the optional `cheerio` peer dependency to be installed.
   * If cheerio is not installed, the full stripped text is returned.
   * @example 'article', 'main', '#content'
   */
  selector?: string;
  /** Strip <script> and <style> blocks entirely. @default true */
  stripScripts?: boolean;
  /** Normalise multiple blank lines into a single blank line. @default true */
  collapseWhitespace?: boolean;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'HTMLFileLoader',
  description: 'Loads local HTML files and strips tags to produce plain text.',
  extensions: ['.html', '.htm', '.xhtml'],
  mimeTypes: ['text/html', 'application/xhtml+xml'],
})
export class HTMLFileLoader extends BaseDocumentLoader {
  private readonly paths: string[];
  private readonly selector?: string;
  private readonly stripScripts: boolean;
  private readonly collapseWhitespace: boolean;
  private readonly extraMetadata: Record<string, unknown>;

  constructor(options: HTMLFileLoaderOptions) {
    super();
    if (!options.path && (!options.paths || options.paths.length === 0)) {
      throw new Error('HTMLFileLoader: provide at least one path via `path` or `paths`.');
    }
    this.paths = options.paths ?? (options.path ? [options.path] : []);
    this.selector = options.selector;
    this.stripScripts = options.stripScripts ?? true;
    this.collapseWhitespace = options.collapseWhitespace ?? true;
    this.extraMetadata = options.metadata ?? {};
  }

  async load(): Promise<Document[]> {
    const docs: Document[] = [];

    for (const filePath of this.paths) {
      const html = await readFile(filePath, { encoding: 'utf-8' });

      // Try cheerio for selector support, fall back to built-in stripper
      let text: string;
      let title = '';

      if (this.selector) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cheerio = await import('cheerio' as string).then((m) => m as any);
          const $ = (
            cheerio.load ?? (cheerio as unknown as { default: typeof cheerio.load }).default
          )(html);
          title = $('title').first().text().trim();
          text = this.clean($(this.selector).text());
        } catch {
          // cheerio not installed — fall back
          text = this.stripTags(html);
        }
      } else {
        title = this.extractTitle(html);
        text = this.stripTags(html);
      }

      docs.push(
        this.createDocument(text, {
          source: basename(filePath),
          filePath,
          loaderType: 'html',
          ...(title && { title }),
          ...this.extraMetadata,
        })
      );
    }

    return docs;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  private stripTags(html: string): string {
    let text = html;

    if (this.stripScripts) {
      // Remove <script> blocks
      text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
      // Remove <style> blocks
      text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    }

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');
    // Replace block-level tags with newlines for readability
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode common HTML entities
    text = this.decodeEntities(text);

    return this.clean(text);
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&hellip;/g, '...')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  }

  private clean(text: string): string {
    if (!this.collapseWhitespace) return text.trim();
    return text
      .replace(/[ \t]+/g, ' ') // collapse inline spaces
      .replace(/\n{3,}/g, '\n\n') // collapse multiple blank lines
      .trim();
  }
}
