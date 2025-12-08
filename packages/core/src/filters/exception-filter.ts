import { Request, Response } from '../types';

/**
 * Arguments host provides access to the underlying platform request/response
 */
export interface ArgumentsHost {
  switchToHttp(): {
    getRequest<T = Request>(): T;
    getResponse<T = Response>(): T;
  };
  getType(): string;
}

/**
 * Exception filter interface
 */
export interface ExceptionFilter<T = unknown> {
  catch(exception: T, host: ArgumentsHost): void | Promise<void>;
}

/**
 * Implementation of ArgumentsHost
 */
export class ArgumentsHostImpl implements ArgumentsHost {
  constructor(
    private readonly request: Request,
    private readonly response: Response
  ) {}

  switchToHttp(): { getRequest: <T = Request>() => T; getResponse: <T = Response>() => T } {
    return {
      getRequest: <T = Request>(): T => this.request as T,
      getResponse: <T = Response>(): T => this.response as T,
    };
  }

  getType(): string {
    return 'http';
  }
}

/**
 * Decorator to mark a class as an exception filter
 */
export function Catch(...exceptions: Array<new (...args: never[]) => unknown>): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata('hazel:exception-filter', exceptions, target);
  };
}

/**
 * Get exception types that a filter handles
 */
export function getFilterExceptions(filter: object): Array<new (...args: unknown[]) => unknown> {
  return Reflect.getMetadata('hazel:exception-filter', filter.constructor) || [];
}
