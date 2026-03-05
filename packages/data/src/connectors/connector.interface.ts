/**
 * Connector interfaces for data sources and sinks.
 * All connectors implement DataSource<T> or DataSink<T>.
 */

export interface DataSource<T = unknown> {
  readonly name: string;
  /** Open/initialize the connection */
  open(): Promise<void>;
  /** Close/release the connection */
  close(): Promise<void>;
  /** Read all records as an array */
  readAll(): Promise<T[]>;
  /** Read records as an async generator (streaming) */
  read(): AsyncGenerator<T>;
}

export interface DataSink<T = unknown> {
  readonly name: string;
  open(): Promise<void>;
  close(): Promise<void>;
  /** Write a single record */
  write(record: T): Promise<void>;
  /** Write a batch of records (more efficient when supported) */
  writeBatch(records: T[]): Promise<void>;
}

export interface ConnectorOptions {
  /** Connector display name */
  name?: string;
}
