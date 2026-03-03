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
  }

  get dataSource(): DataSource {
    return this._dataSource;
  }

  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this._dataSource.getRepository(entity);
  }

  async onModuleInit(): Promise<void> {
    try {
      if (!this._dataSource.isInitialized) {
        await this._dataSource.initialize();
      }
      logger.info('TypeORM connected to database');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
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
