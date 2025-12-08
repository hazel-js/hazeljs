import { RequestContext } from '@hazeljs/core';
import { Injectable } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { Container } from '@hazeljs/core';
import { Type } from '@hazeljs/core';
import { AuthService } from './auth.service';

export interface AuthGuardOptions {
  roles?: string[];
}

export interface IAuthGuard {
  canActivate(context: RequestContext, options?: AuthGuardOptions): Promise<boolean>;
}

interface AuthError extends Error {
  status?: number;
}

@Injectable()
export class AuthGuard implements IAuthGuard {
  constructor(private authService: AuthService) {}

  async canActivate(context: RequestContext, options?: AuthGuardOptions): Promise<boolean> {
    const authHeader = context.headers['authorization'];
    if (!authHeader) {
      const error = new Error('No authorization header') as AuthError;
      error.status = 400;
      throw error;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      const error = new Error('Invalid authorization header format') as AuthError;
      error.status = 400;
      throw error;
    }

    try {
      const user = await this.authService.verifyToken(token);
      if (!user) {
        const error = new Error('Invalid token') as AuthError;
        error.status = 401;
        throw error;
      }

      // Check roles if specified
      if (options?.roles && !options.roles.includes(user.role)) {
        const error = new Error('Insufficient permissions') as AuthError;
        error.status = 403;
        throw error;
      }

      // Attach user to context
      context.user = user;
      return true;
    } catch (error: unknown) {
      const authError = error as AuthError;
      logger.error(
        `[${context.method}] ${context.url} - ${authError.message} (status: ${authError.status || 500})`
      );
      if (process.env.NODE_ENV === 'development' && authError.stack) {
        logger.debug(authError.stack);
      }
      throw authError;
    }
  }
}

// Decorator factory for protecting routes
export function Auth(options?: AuthGuardOptions) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    descriptor.value = async function (context: RequestContext): Promise<unknown> {
      try {
        // Get the auth guard instance from the container
        const container = Container.getInstance();
        const guard = container.resolve<AuthGuard>(AuthGuard as Type<AuthGuard>);

        if (!guard) {
          throw new Error('AuthGuard not found. Make sure to provide an AuthGuard implementation.');
        }

        await guard.canActivate(context, options);
        return originalMethod.call(this, context);
      } catch (error: unknown) {
        const authError = error as AuthError;
        logger.error(
          `[${context.method}] ${context.url} - ${authError.message} (status: ${authError.status || 500})`
        );
        if (process.env.NODE_ENV === 'development' && authError.stack) {
          logger.debug(authError.stack);
        }
        throw authError;
      }
    };
    return descriptor;
  };
}
