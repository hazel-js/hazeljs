import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';
import {
  DeepPartial,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { TypeOrmService } from './typeorm.service';

export type TypeOrmModel = ObjectLiteral & { id?: string | number };

@Injectable()
export abstract class BaseRepository<T extends TypeOrmModel> {
  protected readonly entity: EntityTarget<T>;

  constructor(
    protected readonly typeOrm: TypeOrmService,
    entity: EntityTarget<T>
  ) {
    this.entity = entity;
  }

  protected get repository(): Repository<T> {
    return this.typeOrm.getRepository(this.entity);
  }

  protected handleError(error: unknown): never {
    logger.error('Database error:', error);

    const err = error as Error & { code?: string; constraint?: string };
    if (err.code === '23505') {
      throw new Error(
        `Unique constraint violation${err.constraint ? ` on ${err.constraint}` : ''}`
      );
    }
    if (err.code === '23503') {
      throw new Error('Foreign key constraint violation');
    }
    if (err.name === 'EntityNotFoundError') {
      throw new Error('Record not found');
    }

    throw new Error(`Database error: ${err.message}`);
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      return await this.repository.find(options ?? {});
    } catch (error) {
      return this.handleError(error);
    }
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async save(entity: T | DeepPartial<T>): Promise<T> {
    try {
      return await this.repository.save(entity as T);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(criteria: FindOptionsWhere<T>, partial: DeepPartial<T>): Promise<void> {
    try {
      // TypeORM's update expects QueryDeepPartialEntity<T>; DeepPartial<T> is compatible at runtime
      await this.repository.update(criteria, partial as Parameters<Repository<T>['update']>[1]);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(criteria: FindOptionsWhere<T>): Promise<void> {
    try {
      await this.repository.delete(criteria);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    try {
      return await this.repository.count(options ?? {});
    } catch (error) {
      return this.handleError(error);
    }
  }
}
