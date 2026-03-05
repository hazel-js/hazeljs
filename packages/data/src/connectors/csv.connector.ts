import { createReadStream, createWriteStream, existsSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import type { DataSource, DataSink } from './connector.interface';

export interface CsvSourceOptions {
  filePath: string;
  delimiter?: string;
  hasHeader?: boolean;
  /** Custom header names (used when hasHeader is false) */
  headers?: string[];
  name?: string;
}

export interface CsvSinkOptions {
  filePath: string;
  delimiter?: string;
  /** Write header row on open */
  writeHeader?: boolean;
  name?: string;
}

/**
 * CSV file data source — reads records from a CSV file.
 *
 * @example
 * const source = new CsvSource({ filePath: './data.csv', hasHeader: true });
 * await source.open();
 * const records = await source.readAll();
 * await source.close();
 */
export class CsvSource implements DataSource<Record<string, string>> {
  readonly name: string;
  private readonly filePath: string;
  private readonly delimiter: string;
  private readonly hasHeader: boolean;
  private readonly customHeaders?: string[];

  constructor(options: CsvSourceOptions) {
    this.name = options.name ?? `csv:${options.filePath}`;
    this.filePath = options.filePath;
    this.delimiter = options.delimiter ?? ',';
    this.hasHeader = options.hasHeader ?? true;
    this.customHeaders = options.headers;
  }

  async open(): Promise<void> {
    if (!existsSync(this.filePath)) {
      throw new Error(`CSV file not found: ${this.filePath}`);
    }
  }

  async close(): Promise<void> {
    // No-op for file reads
  }

  async readAll(): Promise<Record<string, string>[]> {
    const records: Record<string, string>[] = [];
    for await (const record of this.read()) {
      records.push(record);
    }
    return records;
  }

  async *read(): AsyncGenerator<Record<string, string>> {
    const rl = createInterface({
      input: createReadStream(this.filePath),
      crlfDelay: Infinity,
    });

    let headers: string[] | null = this.customHeaders ?? null;
    let isFirst = true;

    for await (const line of rl) {
      const cols = this.parseLine(line);
      if (isFirst && this.hasHeader && !this.customHeaders) {
        headers = cols;
        isFirst = false;
        continue;
      }
      isFirst = false;
      if (!headers) {
        headers = cols.map((_, i) => `col${i}`);
      }
      const record: Record<string, string> = {};
      headers.forEach((h, i) => { record[h] = cols[i] ?? ''; });
      yield record;
    }
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === this.delimiter && !inQuote) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}

/**
 * CSV file data sink — writes records to a CSV file.
 *
 * @example
 * const sink = new CsvSink({ filePath: './output.csv', writeHeader: true });
 * await sink.open();
 * await sink.writeBatch(records);
 * await sink.close();
 */
export class CsvSink implements DataSink<Record<string, unknown>> {
  readonly name: string;
  private readonly filePath: string;
  private readonly delimiter: string;
  private readonly writeHeader: boolean;
  private headers: string[] | null = null;
  private stream: ReturnType<typeof createWriteStream> | null = null;
  private headerWritten = false;

  constructor(options: CsvSinkOptions) {
    this.name = options.name ?? `csv:${options.filePath}`;
    this.filePath = options.filePath;
    this.delimiter = options.delimiter ?? ',';
    this.writeHeader = options.writeHeader ?? true;
  }

  async open(): Promise<void> {
    this.stream = createWriteStream(this.filePath, { encoding: 'utf8' });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) { resolve(); return; }
      this.stream.end((err: Error | null | undefined) => err ? reject(err) : resolve());
    });
  }

  async write(record: Record<string, unknown>): Promise<void> {
    if (!this.stream) throw new Error('CsvSink: call open() before write()');

    if (!this.headers) {
      this.headers = Object.keys(record);
    }

    if (this.writeHeader && !this.headerWritten) {
      this.writeLine(this.headers);
      this.headerWritten = true;
    }

    this.writeLine(this.headers.map((h) => String(record[h] ?? '')));
  }

  async writeBatch(records: Record<string, unknown>[]): Promise<void> {
    for (const r of records) await this.write(r);
  }

  private writeLine(cols: string[]): void {
    const line = cols
      .map((c) => (c.includes(this.delimiter) || c.includes('"') || c.includes('\n') ? `"${c.replace(/"/g, '""')}"` : c))
      .join(this.delimiter) + '\n';
    this.stream!.write(line);
  }
}
