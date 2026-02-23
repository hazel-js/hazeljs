import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';

export type TransformFn<T = unknown, R = unknown> = (input: T) => R | Promise<R>;

/**
 * Transformer Service - Data transformations
 * Provides utilities for common data transformation patterns
 */
@Injectable()
export class TransformerService {
  private transforms: Map<string, TransformFn> = new Map();

  register(name: string, fn: TransformFn): void {
    this.transforms.set(name, fn);
    logger.debug(`Registered transform: ${name}`);
  }

  async apply<T, R>(name: string, input: T): Promise<R> {
    const fn = this.transforms.get(name);
    if (!fn) {
      throw new Error(`Transform not found: ${name}`);
    }
    const result = fn(input);
    return (result instanceof Promise ? await result : result) as R;
  }

  pipe<T>(
    ...fns: Array<(x: unknown) => unknown | Promise<unknown>>
  ): (input: T) => Promise<unknown> {
    return async (input: T) => {
      let data: unknown = input;
      for (const fn of fns) {
        const result = fn(data);
        data = result instanceof Promise ? await result : result;
      }
      return data;
    };
  }

  map<T, R>(fn: (item: T) => R | Promise<R>): (items: T[]) => Promise<R[]> {
    return async (items: T[]) => {
      return Promise.all(items.map((item) => Promise.resolve(fn(item))));
    };
  }

  filter<T>(predicate: (item: T) => boolean | Promise<boolean>): (items: T[]) => Promise<T[]> {
    return async (items: T[]) => {
      const results: T[] = [];
      for (const item of items) {
        const keep = await Promise.resolve(predicate(item));
        if (keep) results.push(item);
      }
      return results;
    };
  }
}
