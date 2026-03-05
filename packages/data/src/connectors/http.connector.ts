import type { DataSource, DataSink } from './connector.interface';

export interface HttpSourceOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  /** JSON path to the array in the response (e.g. "data.items") */
  dataPath?: string;
  /** Pagination: next page URL extracted from response (e.g. "meta.next") */
  nextPagePath?: string;
  name?: string;
  timeoutMs?: number;
}

export interface HttpSinkOptions {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  /** Batch size — how many records to send per request (default: 1) */
  batchSize?: number;
  /** JSON field name to wrap records in (e.g. "records" → { records: [...] }) */
  bodyKey?: string;
  name?: string;
  timeoutMs?: number;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((cur, key) => {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

/**
 * HTTP API data source — reads records from a REST API.
 * Supports pagination via `nextPagePath`.
 *
 * @example
 * const source = new HttpSource({
 *   url: 'https://api.example.com/users',
 *   dataPath: 'data',
 *   nextPagePath: 'meta.next',
 * });
 */
export class HttpSource implements DataSource<unknown> {
  readonly name: string;
  private readonly options: HttpSourceOptions;

  constructor(options: HttpSourceOptions) {
    this.name = options.name ?? `http:${options.url}`;
    this.options = options;
  }

  async open(): Promise<void> {
    // Validate connectivity on open
    const res = await this.fetchPage(this.options.url);
    if (!res.ok) throw new Error(`HttpSource: Cannot reach ${this.options.url} (${res.status})`);
  }

  async close(): Promise<void> {}

  async readAll(): Promise<unknown[]> {
    const all: unknown[] = [];
    for await (const r of this.read()) all.push(r);
    return all;
  }

  async *read(): AsyncGenerator<unknown> {
    let url: string | null = this.options.url;

    while (url) {
      const res = await this.fetchPage(url);
      if (!res.ok) throw new Error(`HttpSource: ${res.status} ${await res.text()}`);

      const body: unknown = await res.json();

      const items = this.options.dataPath
        ? getNestedValue(body, this.options.dataPath)
        : body;

      if (Array.isArray(items)) {
        for (const item of items) yield item;
      } else {
        yield body;
        break;
      }

      url = this.options.nextPagePath
        ? (getNestedValue(body, this.options.nextPagePath) as string | null) ?? null
        : null;
    }
  }

  private fetchPage(url: string): Promise<Response> {
    const controller = new AbortController();
    if (this.options.timeoutMs) {
      setTimeout(() => controller.abort(), this.options.timeoutMs);
    }
    return fetch(url, {
      method: this.options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...this.options.headers },
      body: this.options.body ? JSON.stringify(this.options.body) : undefined,
      signal: controller.signal,
    });
  }
}

/**
 * HTTP API data sink — writes records to a REST API endpoint.
 *
 * @example
 * const sink = new HttpSink({
 *   url: 'https://api.example.com/ingest',
 *   method: 'POST',
 *   batchSize: 100,
 *   bodyKey: 'records',
 * });
 */
export class HttpSink implements DataSink<unknown> {
  readonly name: string;
  private readonly options: HttpSinkOptions;
  private buffer: unknown[] = [];

  constructor(options: HttpSinkOptions) {
    this.name = options.name ?? `http:${options.url}`;
    this.options = { batchSize: 1, ...options };
  }

  async open(): Promise<void> {}

  async close(): Promise<void> {
    if (this.buffer.length > 0) await this.flush();
  }

  async write(record: unknown): Promise<void> {
    this.buffer.push(record);
    if (this.buffer.length >= (this.options.batchSize ?? 1)) {
      await this.flush();
    }
  }

  async writeBatch(records: unknown[]): Promise<void> {
    this.buffer.push(...records);
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const payload = this.options.bodyKey
      ? { [this.options.bodyKey]: this.buffer }
      : this.buffer.length === 1 ? this.buffer[0] : this.buffer;

    const controller = new AbortController();
    if (this.options.timeoutMs) {
      setTimeout(() => controller.abort(), this.options.timeoutMs);
    }

    const res = await fetch(this.options.url, {
      method: this.options.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...this.options.headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HttpSink: ${res.status} ${await res.text()}`);
    }

    this.buffer = [];
  }
}
