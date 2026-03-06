/**
 * DocxLoader
 *
 * Loads Microsoft Word (.docx) files using the optional `mammoth` peer
 * dependency.  Converts rich-text document content to plain text or HTML.
 *
 * Install the peer dependency:
 * ```bash
 * npm install mammoth
 * ```
 *
 * @example
 * ```typescript
 * const loader = new DocxLoader({ path: './proposal.docx' });
 * const docs = await loader.load();
 * // docs[0].content === extracted plain text
 * // docs[0].metadata.source === 'proposal.docx'
 * ```
 *
 * Extract HTML instead of plain text (useful for preserving table structure):
 * ```typescript
 * const loader = new DocxLoader({ path: './report.docx', outputFormat: 'html' });
 * ```
 *
 * Legacy .doc files are NOT supported — mammoth only handles the modern OOXML
 * format (.docx).  Use LibreOffice to convert .doc → .docx first.
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface DocxLoaderOptions {
  /** Path to the .docx file. */
  path: string;
  /**
   * Output format.
   * - `'text'` (default) — plain text, stripping all formatting
   * - `'html'` — HTML string preserving basic structure
   */
  outputFormat?: 'text' | 'html';
  /**
   * Custom style map passed to mammoth for HTML output.
   * @see https://github.com/mwilliamson/mammoth.js#writing-style-maps
   */
  styleMap?: string[];
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'DocxLoader',
  description: 'Loads Microsoft Word .docx files using mammoth (optional peer dependency).',
  extensions: ['.docx'],
  mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
})
export class DocxLoader extends BaseDocumentLoader {
  private readonly opts: Required<DocxLoaderOptions>;

  constructor(options: DocxLoaderOptions) {
    super();
    this.opts = {
      path: options.path,
      outputFormat: options.outputFormat ?? 'text',
      styleMap: options.styleMap ?? [],
      metadata: options.metadata ?? {},
    };
  }

  async load(): Promise<Document[]> {
    // Dynamic import — mammoth is only required when DocxLoader is actually used
    let mammoth: {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
      convertToHtml: (opts: {
        buffer: Buffer;
        styleMap?: string[];
      }) => Promise<{ value: string; messages: unknown[] }>;
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('mammoth') as typeof mammoth & { default?: typeof mammoth };
      mammoth = mod.default ?? mod;
    } catch {
      throw new Error('[DocxLoader] mammoth is not installed. Run: npm install mammoth');
    }

    const buffer = await readFile(this.opts.path);
    const fileName = basename(this.opts.path);

    let content: string;
    let messages: unknown[];

    if (this.opts.outputFormat === 'html') {
      const result = await mammoth.convertToHtml({
        buffer,
        styleMap: this.opts.styleMap.length > 0 ? this.opts.styleMap : undefined,
      });
      content = result.value;
      messages = result.messages;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
      messages = result.messages;
    }

    // Log any conversion warnings (e.g. unsupported features in the DOCX)
    const warnings = (messages as Array<{ type: string; message: string }>)
      .filter((m) => m.type === 'warning')
      .map((m) => m.message);

    if (warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[DocxLoader] Conversion warnings for ${fileName}:`, warnings);
    }

    return [
      this.createDocument(content, {
        source: fileName,
        filePath: this.opts.path,
        loaderType: 'docx',
        outputFormat: this.opts.outputFormat,
        ...this.opts.metadata,
      }),
    ];
  }
}
