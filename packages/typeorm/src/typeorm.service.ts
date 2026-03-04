import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

export interface TypeOrmServiceOptions {
  /**
   * Pre-created DataSource (e.g. for testing). If provided, options are ignored.
   */
  dataSource?: DataSource;
  /**
   * DataSource options. Used when dataSource is not provided.
   * If neither dataSource nor options provided, a default DataSource is created from DATABASE_URL.
   */
  options?: DataSourceOptions;
}

@Injectable()
export class TypeOrmService {
  private _dataSource: DataSource;
  /**
   * Resolves when the DataSource is fully initialised. Started eagerly in the
   * constructor so that by the time the first HTTP request arrives the
   * connection is already established — no manual `onModuleInit` call needed.
   */
  private _ready: Promise<void>;

  constructor(options?: TypeOrmServiceOptions) {
    if (options?.dataSource) {
      this._dataSource = options.dataSource;
    } else if (options?.options) {
      this._dataSource = new DataSource(options.options);
    } else {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'TypeOrmService requires either options.dataSource, options.options, or DATABASE_URL env'
        );
      }
      this._dataSource = new DataSource({
        type: 'postgres',
        url,
        synchronize: false,
        logging: false,
      } as DataSourceOptions);
    }

    // Kick off the connection immediately. Errors are surfaced via ready() /
    // onModuleInit() and on the first query attempt.
    this._ready = this._dataSource.isInitialized
      ? Promise.resolve()
      : this._dataSource
          .initialize()
          .then(() => {
            logger.info('TypeORM connected to database');
          })
          .catch((err: unknown) => {
            logger.error('Failed to connect to database:', err);
            throw err;
          });
  }

  get dataSource(): DataSource {
    return this._dataSource;
  }

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this._dataSource.getRepository(entity);
  }

  /**
   * Returns a promise that resolves once the DataSource is initialised.
   * Useful in `main.ts` when you want to block the server start until the
   * database is ready (optional but recommended for production).
   *
   * @example
   * ```ts
   * // Optional — guarantees DB is up before first request
   * await app.getContainer().resolve(TypeOrmService).ready();
   * await app.listen(3000);
   * ```
   */
  ready(): Promise<void> {
    return this._ready;
  }

  /**
   * Awaits the DataSource initialisation. Idempotent — safe to call multiple
   * times. Kept for compatibility with frameworks that call `onModuleInit`
   * on lifecycle-aware services.
   */
  async onModuleInit(): Promise<void> {
    await this._ready;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this._dataSource.isInitialized) {
        await this._dataSource.destroy();
      }
      logger.info('TypeORM disconnected from database');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }
}
