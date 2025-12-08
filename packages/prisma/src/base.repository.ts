import { Injectable } from '@hazeljs/core';
import { PrismaService } from './prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import logger from '@hazeljs/core';

// Helper type for dynamic model access
export type PrismaModel = {
  id: number;
  [key: string]: unknown;
};

export type WhereUniqueInput = {
  id?: number;
  [key: string]: unknown;
};

export type UpdateInput = {
  [key: string]: unknown;
};

type PrismaModelDelegate = {
  findMany: () => Promise<unknown[]>;
  findUnique: (args: { where: WhereUniqueInput }) => Promise<unknown | null>;
  create: (args: { data: unknown }) => Promise<unknown>;
  update: (args: { where: WhereUniqueInput; data: UpdateInput }) => Promise<unknown>;
  delete: (args: { where: WhereUniqueInput }) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
};

@Injectable()
export abstract class BaseRepository<T extends PrismaModel> {
  protected readonly model: string;

  constructor(
    protected readonly prisma: PrismaService,
    model: string
  ) {
    this.model = model;
  }

  protected get prismaClient(): PrismaService {
    return this.prisma;
  }

  protected get modelDelegate(): PrismaModelDelegate {
    return (this.prismaClient as unknown as { [key: string]: PrismaModelDelegate })[this.model];
  }

  protected handleError(error: unknown): never {
    logger.error('Database error:', error);

    if (error instanceof PrismaClientKnownRequestError) {
      let errorMessage: string;
      let target: string[] | undefined;

      switch (error.code) {
        case 'P2002':
          target = error.meta?.target as string[] | undefined;
          errorMessage = `Unique constraint violation on field${target ? `s: ${target.join(', ')}` : ''}`;
          break;
        case 'P2025':
          errorMessage = 'Record not found';
          break;
        case 'P2003':
          errorMessage = 'Foreign key constraint violation';
          break;
        default:
          errorMessage = `Database error: ${(error as Error).message}`;
      }

      throw new Error(errorMessage);
    }

    throw new Error(`Database error: ${(error as Error).message}`);
  }

  async findMany(): Promise<T[]> {
    const result = await this.modelDelegate.findMany();
    return result as T[];
  }

  async findOne(where: WhereUniqueInput): Promise<T | null> {
    const result = await this.modelDelegate.findUnique({ where });
    return result as T | null;
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const result = await this.modelDelegate.create({ data });
    return result as T;
  }

  async update(where: WhereUniqueInput, data: UpdateInput): Promise<T> {
    const result = await this.modelDelegate.update({ where, data });
    return result as T;
  }

  async delete(where: WhereUniqueInput): Promise<T> {
    const result = await this.modelDelegate.delete({ where });
    return result as T;
  }

  async count(args?: unknown): Promise<number> {
    return this.modelDelegate.count(args);
  }
}
