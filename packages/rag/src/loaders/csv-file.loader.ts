/**
 * CSVFileLoader
 *
 * Loads a CSV file and converts each row to a `Document`.
 * No external dependency — uses a built-in parser that handles quoted fields
 * and escaped commas.
 *
 * Each row's content is built from either:
 *  - A specific `contentColumns` list (concatenated with a separator), or
 *  - All columns joined as `key: value` pairs.
 *
 * @example
 * ```typescript
 * // products.csv has columns: id, name, description, price
 * const loader = new CSVFileLoader({
 *   path: './products.csv',
 *   contentColumns: ['name', 'description'],
 *   metadataColumns: ['id', 'price'],
 * });
 * const docs = await loader.load();
 * // docs[0].content  === "Product Name\nProduct description here"
 * // docs[0].metadata === { id: '1', price: '9.99', row: 0, source: 'products.csv' }
 * ```
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface CSVFileLoaderOptions {
  path: string;
  /** Column delimiter. @default ',' */
  delimiter?: string;
  /** Quote character for fields containing delimiters. @default '"' */
  quote?: string;
  /** If true, the first row is a header row. @default true */
  hasHeader?: boolean;
  /**
   * Columns whose values are concatenated to form the document content.
   * If omitted, all columns are used in `key: value` format.
   */
  contentColumns?: string[];
  /** Separator used between content column values. @default '\n' */
  contentSeparator?: string;
  /**
   * Columns included in the document metadata.
   * If omitted, all non-content columns are included.
   */
  metadataColumns?: string[];
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'CSVFileLoader',
  description: 'Loads rows from a CSV file, one document per row.',
  extensions: ['.csv'],
  mimeTypes: ['text/csv'],
})
export class CSVFileLoader extends BaseDocumentLoader {
  private readonly opts: Required<CSVFileLoaderOptions>;

  constructor(options: CSVFileLoaderOptions) {
    super();
    this.opts = {
      path: options.path,
      delimiter: options.delimiter ?? ',',
      quote: options.quote ?? '"',
      hasHeader: options.hasHeader ?? true,
      contentColumns: options.contentColumns ?? [],
      contentSeparator: options.contentSeparator ?? '\n',
      metadataColumns: options.metadataColumns ?? [],
      metadata: options.metadata ?? {},
    };
  }

  async load(): Promise<Document[]> {
    const raw = await readFile(this.opts.path, { encoding: 'utf-8' });
    const rows = this.parseCSV(raw);

    if (rows.length === 0) return [];

    let headers: string[];
    let dataRows: string[][];

    if (this.opts.hasHeader) {
      headers = rows[0];
      dataRows = rows.slice(1);
    } else {
      // Generate column names col0, col1, ...
      headers = rows[0].map((_, i) => `col${i}`);
      dataRows = rows;
    }

    const fileName = basename(this.opts.path);
    const contentCols = this.opts.contentColumns.length > 0
      ? this.opts.contentColumns
      : headers;
    const metaCols = this.opts.metadataColumns.length > 0
      ? this.opts.metadataColumns
      : headers.filter((h) => !contentCols.includes(h));

    return dataRows
      .map((row, rowIdx) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });

        // Build content
        const contentParts = contentCols
          .filter((col) => col in obj && obj[col].trim().length > 0)
          .map((col) =>
            contentCols.length === 1
              ? obj[col]                        // single column: raw value
              : `${col}: ${obj[col]}`           // multiple: key: value
          );
        const content = contentParts.join(this.opts.contentSeparator);

        // Build metadata
        const metadata: Record<string, unknown> = {
          source: fileName,
          filePath: this.opts.path,
          row: rowIdx,
          loaderType: 'csv',
          ...this.opts.metadata,
        };
        for (const col of metaCols) {
          if (col in obj) metadata[col] = obj[col];
        }

        return this.createDocument(content, metadata);
      })
      .filter((doc) => doc.content.length > 0);
  }

  /**
   * Minimal RFC-4180-compliant CSV parser.
   * Handles quoted fields with embedded commas and escaped quotes.
   */
  private parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (line.trim() === '') continue;
      rows.push(this.parseLine(line));
    }

    return rows;
  }

  private parseLine(line: string): string[] {
    const fields: string[] = [];
    const { delimiter, quote } = this.opts;
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === quote) {
        if (inQuotes && line[i + 1] === quote) {
          // Escaped quote inside quoted field
          field += quote;
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        fields.push(field);
        field = '';
        i++;
      } else {
        field += char;
        i++;
      }
    }

    fields.push(field);
    return fields;
  }
}
