import { createReadStream, createWriteStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import type { DataSource, DataSink } from './connector.interface';

export interface JsonlSourceOptions {
  filePath: string;
  name?: string;
}

export interface JsonlSinkOptions {
  filePath: string;
  name?: string;
}

/**
 * JSONL (newline-delimited JSON) data source — reads records from a .jsonl file.
 * Each line is a valid JSON object. Efficient for streaming and large datasets.
 *
 * @example
 * const source = new JsonlSource({ filePath: './data.jsonl' });
 * await source.open();
 * for await (const record of source.read()) {
 *   console.log(record);
 * }
 * await source.close();
 */
export class JsonlSource implements DataSource<Record<string, unknown>> {
  readonly name: string;
  private readonly filePath: string;

  constructor(options: JsonlSourceOptions) {
    this.name = options.name ?? `jsonl:${options.filePath}`;
    this.filePath = options.filePath;
  }

  async open(): Promise<void> {
    if (!existsSync(this.filePath)) {
      throw new Error(`JSONL file not found: ${this.filePath}`);
    }
  }

  async close(): Promise<void> {
    // No-op for file reads
  }

  async readAll(): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    for await (const record of this.read()) {
      records.push(record);
    }
    return records;
  }

  async *read(): AsyncGenerator<Record<string, unknown>> {
    const rl = createInterface({
      input: createReadStream(this.filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        yield record;
      } catch (error) {
        throw new Error(
          `Failed to parse JSONL line: ${line.substring(0, 100)}... Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}

/**
 * JSONL data sink — writes records to a .jsonl file.
 * Each record is written as a single line of JSON.
 *
 * @example
 * const sink = new JsonlSink({ filePath: './output.jsonl' });
 * await sink.open();
 * await sink.writeBatch(records);
 * await sink.close();
 */
export class JsonlSink implements DataSink<Record<string, unknown>> {
  readonly name: string;
  private readonly filePath: string;
  private stream: ReturnType<typeof createWriteStream> | null = null;

  constructor(options: JsonlSinkOptions) {
    this.name = options.name ?? `jsonl:${options.filePath}`;
    this.filePath = options.filePath;
  }

  async open(): Promise<void> {
    this.stream = createWriteStream(this.filePath, { encoding: 'utf8' });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        resolve();
        return;
      }
      this.stream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
  }

  async write(record: Record<string, unknown>): Promise<void> {
    if (!this.stream) throw new Error('JsonlSink: call open() before write()');

    const line = JSON.stringify(record) + '\n';
    this.stream.write(line);
  }

  async writeBatch(records: Record<string, unknown>[]): Promise<void> {
    if (!this.stream) throw new Error('JsonlSink: call open() before writeBatch()');

    for (const record of records) {
      const line = JSON.stringify(record) + '\n';
      this.stream.write(line);
    }
  }
}
