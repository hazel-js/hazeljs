import { Type } from './types';
import { RequestContext } from './types';
import { Container } from './container';

export interface Middleware {
  use(context: RequestContext, next: () => Promise<unknown>): Promise<unknown>;
}

export type MiddlewareFunction = (
  context: RequestContext,
  next: () => Promise<unknown>
) => Promise<unknown>;

export class MiddlewareHandler {
  constructor(private container: Container) {}

  async executeMiddlewareChain(
    middlewares: Type<Middleware>[],
    context: RequestContext,
    finalHandler: () => Promise<unknown>
  ): Promise<unknown> {
    const next = async (): Promise<unknown> => {
      if (!middlewares || middlewares.length === 0) {
        try {
          return await finalHandler();
        } catch (error) {
          const err = error as { status?: number };
          if (!err.status) {
            err.status = 500;
          }
          throw error;
        }
      }

      const middleware = this.container.resolve(middlewares[0]);
      const remainingMiddlewares = middlewares.slice(1);

      try {
        return await middleware.use(context, () =>
          this.executeMiddlewareChain(remainingMiddlewares, context, finalHandler)
        );
      } catch (error) {
        const err = error as { status?: number };
        if (!err.status) {
          err.status = 500;
        }
        throw error;
      }
    };

    try {
      return await next();
    } catch (error) {
      const err = error as { status?: number };
      if (!err.status) {
        err.status = 500;
      }
      throw error;
    }
  }
}
