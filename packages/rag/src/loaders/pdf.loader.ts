/**
 * PdfLoader
 *
 * Loads PDF files and converts them to `Document` objects using the
 * optional `pdf-parse` peer dependency.
 *
 * Install the peer dependency:
 * ```bash
 * npm install pdf-parse
 * # or
 * npm install pdfjs-dist   # alternative — see pdfMode option
 * ```
 *
 * Each PDF can be loaded as:
 *  - **one document** (default) — the entire extracted text as a single chunk
 *  - **one document per page** — `splitPages: true`
 *
 * Metadata extracted from the PDF info dictionary (author, creation date,
 * title, subject, keywords, page count) is stored in each document.
 *
 * @example
 * ```typescript
 * const loader = new PdfLoader({ path: './report.pdf' });
 * const docs = await loader.load();
 * // docs[0].content  === full extracted text
 * // docs[0].metadata.pageCount === 42
 *
 * // One document per page:
 * const loader = new PdfLoader({ path: './report.pdf', splitPages: true });
 * const docs = await loader.load();
 * // docs.length === 42
 * // docs[0].metadata.pageNumber === 1
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface PdfLoaderOptions {
  /** Path to the PDF file. */
  path: string;
  /**
   * Split the PDF into one document per page.
   * @default false
   */
  splitPages?: boolean;
  /**
   * Maximum number of pages to extract.
   * @default all pages
   */
  maxPages?: number;
  /**
   * Password for encrypted PDFs.
   */
  password?: string;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'PdfLoader',
  description: 'Loads PDF files using pdf-parse (optional peer dependency).',
  extensions: ['.pdf'],
  mimeTypes: ['application/pdf'],
})
export class PdfLoader extends BaseDocumentLoader {
  private readonly opts: Required<Omit<PdfLoaderOptions, 'password' | 'maxPages'>> & {
    password?: string;
    maxPages?: number;
  };

  constructor(options: PdfLoaderOptions) {
    super();
    this.opts = {
      path: options.path,
      splitPages: options.splitPages ?? false,
      maxPages: options.maxPages,
      password: options.password,
      metadata: options.metadata ?? {},
    };
  }

  async load(): Promise<Document[]> {
    // Dynamic import so pdf-parse is only required when PdfLoader is actually used
    let pdfParse: (buffer: Buffer, options?: object) => Promise<{
      text: string;
      numpages: number;
      info: Record<string, unknown>;
      metadata: { _metadata?: Record<string, unknown> };
      version: string;
    }>;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('pdf-parse') as { default?: typeof pdfParse } | typeof pdfParse;
      pdfParse = (typeof mod === 'function' ? mod : mod.default) as typeof pdfParse;
    } catch {
      throw new Error(
        '[PdfLoader] pdf-parse is not installed. Run: npm install pdf-parse\n' +
        'Alternatively, install pdfjs-dist and use PdfjsLoader.',
      );
    }

    const buffer = await readFile(this.opts.path);
    const fileName = basename(this.opts.path);

    const parseOptions: Record<string, unknown> = {};
    if (this.opts.password) parseOptions['password'] = this.opts.password;
    if (this.opts.maxPages) parseOptions['max'] = this.opts.maxPages;

    // pdf-parse extracts text page-by-page via a custom renderer when we need per-page docs
    if (this.opts.splitPages) {
      return this.loadByPage(pdfParse, buffer, fileName, parseOptions);
    }

    const result = await pdfParse(buffer, parseOptions);

    const infoMetadata = this.extractInfoMetadata(result.info);

    return [
      this.createDocument(result.text, {
        source: fileName,
        filePath: this.opts.path,
        loaderType: 'pdf',
        pageCount: result.numpages,
        pdfVersion: result.version,
        ...infoMetadata,
        ...this.opts.metadata,
      }),
    ];
  }

  private async loadByPage(
    pdfParse: (buf: Buffer, opts?: object) => Promise<{
      text: string;
      numpages: number;
      info: Record<string, unknown>;
      version: string;
      metadata: unknown;
    }>,
    buffer: Buffer,
    fileName: string,
    baseOptions: Record<string, unknown>,
  ): Promise<Document[]> {
    const pages: string[] = [];

    const options = {
      ...baseOptions,
      // pdf-parse page renderer — called once per page
      pagerender: (pageData: {
        getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }>;
      }) =>
        pageData.getTextContent().then((textContent) => {
          const lastY = { y: -1 };
          let text = '';
          for (const item of textContent.items) {
            const y = item.transform[5];
            if (lastY.y !== -1 && Math.abs(lastY.y - y) > 1) {
              text += '\n';
            }
            text += item.str;
            lastY.y = y;
          }
          pages.push(text);
          return text;
        }),
    };

    const result = await pdfParse(buffer, options);
    const infoMetadata = this.extractInfoMetadata(result.info);
    const fileName2 = fileName;

    return pages
      .map((pageText, idx) =>
        this.createDocument(pageText, {
          source: fileName2,
          filePath: this.opts.path,
          loaderType: 'pdf',
          pageNumber: idx + 1,
          pageCount: result.numpages,
          pdfVersion: result.version,
          ...infoMetadata,
          ...this.opts.metadata,
        }),
      )
      .filter((doc) => doc.content.length > 0);
  }

  private extractInfoMetadata(info: Record<string, unknown>): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      Title: 'title',
      Author: 'author',
      Subject: 'subject',
      Keywords: 'keywords',
      Creator: 'creator',
      Producer: 'producer',
      CreationDate: 'creationDate',
      ModDate: 'modificationDate',
    };
    for (const [pdfKey, metaKey] of Object.entries(fieldMap)) {
      if (info[pdfKey]) meta[metaKey] = info[pdfKey];
    }
    return meta;
  }
}
