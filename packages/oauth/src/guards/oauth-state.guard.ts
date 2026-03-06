import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedError,
} from '@hazeljs/core';
import { OAuthService } from '../oauth.service';

/**
 * Guard that validates the OAuth state parameter against a stored value.
 * Use when handling the OAuth callback to prevent CSRF attacks.
 *
 * Expects storedState to be provided via request (e.g., from cookie or session).
 * Set oauth_state and oauth_code_verifier (for PKCE) before redirecting to provider.
 */
@Injectable()
export class OAuthStateGuard implements CanActivate {
  constructor(private readonly oauthService: OAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as {
      query?: { state?: string };
      body?: { state?: string };
      oauth_stored_state?: string;
    };
    const receivedState = request.query?.state ?? request.body?.state;
    const storedState = request.oauth_stored_state;

    if (!receivedState || !storedState) {
      throw new UnauthorizedError('Missing OAuth state');
    }

    if (!this.oauthService.validateState(receivedState, storedState)) {
      throw new UnauthorizedError('Invalid OAuth state');
    }

    return true;
  }
}
