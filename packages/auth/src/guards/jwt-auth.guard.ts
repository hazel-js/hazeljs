import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';
import { AuthService } from '../auth.service';

/**
 * Guard that verifies a Bearer JWT token and attaches the decoded user to
 * the request object.  Use this with @UseGuards() on controllers or methods.
 *
 * @example
 * ```ts
 * @UseGuards(JwtAuthGuard)
 * @Controller('/profile')
 * export class ProfileController {
 *   @Get('/')
 *   getProfile(@CurrentUser() user: AuthUser) {
 *     return user;
 *   }
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest() as Record<string, unknown> & {
      headers: Record<string, string>;
    };

    const authHeader = req.headers?.['authorization'];
    if (!authHeader) {
      const err = Object.assign(new Error('No authorization header'), { status: 400 });
      throw err;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      const err = Object.assign(new Error('Invalid authorization header format'), { status: 400 });
      throw err;
    }

    const user = await this.authService.verifyToken(token);
    if (!user) {
      const err = Object.assign(new Error('Invalid or expired token'), { status: 401 });
      throw err;
    }

    // Attach to req so the router propagates it to context.user and @CurrentUser() can read it.
    req.user = user;
    return true;
  }
}
