import type { DataSource, DataSink } from './connector.interface';

/**
 * In-memory data source — wraps an array for use in pipelines and tests.
 *
 * @example
 * const source = new MemorySource([{ id: 1 }, { id: 2 }]);
 * const records = await source.readAll();
 */
export class MemorySource<T = unknown> implements DataSource<T> {
  readonly name: string;
  private readonly records: T[];

  constructor(records: T[], name = 'memory:source') {
    this.name = name;
    this.records = [...records];
  }

  async open(): Promise<void> {}
  async close(): Promise<void> {}

  async readAll(): Promise<T[]> {
    return [...this.records];
  }

  async *read(): AsyncGenerator<T> {
    for (const r of this.records) yield r;
  }
}

/**
 * In-memory data sink — captures written records for inspection.
 * Useful in tests and pipeline prototyping.
 *
 * @example
 * const sink = new MemorySink<User>();
 * await pipeline.run(source, sink);
 * console.log(sink.records);
 */
export class MemorySink<T = unknown> implements DataSink<T> {
  readonly name: string;
  private _records: T[] = [];

  constructor(name = 'memory:sink') {
    this.name = name;
  }

  async open(): Promise<void> {}
  async close(): Promise<void> {}

  async write(record: T): Promise<void> {
    this._records.push(record);
  }

  async writeBatch(records: T[]): Promise<void> {
    this._records.push(...records);
  }

  get records(): readonly T[] {
    return this._records;
  }

  clear(): void {
    this._records = [];
  }
}
