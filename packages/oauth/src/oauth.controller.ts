import { Controller, Get, Param, Query, Res, Req, type Response } from '@hazeljs/core';
import { OAuthService } from './oauth.service';
import type { SupportedProvider } from './providers/provider.types';

const STATE_COOKIE = 'oauth_state';
const CODE_VERIFIER_COOKIE = 'oauth_code_verifier';
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes
const COOKIE_OPTS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;

function getCookie(
  req: { headers?: Record<string, string | string[] | undefined> },
  name: string
): string | undefined {
  const h = req?.headers?.['cookie'];
  const cookieHeader = Array.isArray(h) ? h[0] : h;
  if (typeof cookieHeader !== 'string') return undefined;
  const part = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return part?.split('=')[1]?.trim();
}

/**
 * Optional controller that provides OAuth routes.
 * Register in your app if you want ready-made /auth/:provider and /auth/:provider/callback routes.
 */
@Controller('/auth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  /**
   * GET /auth/:provider - Redirects user to OAuth provider.
   * Sets state and codeVerifier (for PKCE) in cookies.
   */
  @Get('/:provider')
  async login(@Param('provider') provider: string, @Res() res: Response): Promise<void> {
    const p = provider.toLowerCase() as SupportedProvider;
    if (!['google', 'microsoft', 'github', 'facebook', 'twitter'].includes(p)) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }

    const { url, state, codeVerifier } = this.oauthService.getAuthorizationUrl(p);
    const cookies: string[] = [`${STATE_COOKIE}=${state}; ${COOKIE_OPTS}`];
    if (codeVerifier) {
      cookies.push(`${CODE_VERIFIER_COOKIE}=${codeVerifier}; ${COOKIE_OPTS}`);
    }
    (res.setHeader as (n: string, v: string | string[]) => void)('Set-Cookie', cookies);
    res.status(302);
    res.setHeader('Location', url);
    res.end();
  }

  /**
   * GET /auth/:provider/callback - Handles OAuth callback.
   * Returns JSON with accessToken, user. Use successRedirect/errorRedirect query params for redirects.
   */
  @Get('/:provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query()
    query: { code?: string; state?: string; successRedirect?: string; errorRedirect?: string },
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
    @Res() res: Response
  ): Promise<void> {
    const p = provider.toLowerCase() as SupportedProvider;
    if (!['google', 'microsoft', 'github', 'facebook', 'twitter'].includes(p)) {
      res.status(400).json({ error: 'Invalid provider' });
      return;
    }

    const code = query?.code;
    if (!code) {
      this.redirectOrJson(res, 400, query.errorRedirect, { error: 'Missing authorization code' });
      return;
    }

    const storedState = getCookie(req, STATE_COOKIE);
    const codeVerifier = getCookie(req, CODE_VERIFIER_COOKIE);

    (res.setHeader as (n: string, v: string | string[]) => void)('Set-Cookie', [
      `${STATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`,
      `${CODE_VERIFIER_COOKIE}=; Path=/; HttpOnly; Max-Age=0`,
    ]);

    if (!storedState || query.state !== storedState) {
      this.redirectOrJson(res, 400, query.errorRedirect, { error: 'Invalid state' });
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(p, code, storedState, codeVerifier);

      if (query.successRedirect) {
        res.status(302);
        res.setHeader('Location', query.successRedirect);
        res.end();
        return;
      }

      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth callback failed';
      this.redirectOrJson(res, 401, query.errorRedirect, { error: message });
    }
  }

  private redirectOrJson(
    res: Response,
    status: number,
    errorRedirect?: string,
    json?: { error: string }
  ): void {
    if (errorRedirect) {
      const url = new URL(errorRedirect);
      if (json?.error) url.searchParams.set('error', json.error);
      res.status(302);
      res.setHeader('Location', url.toString());
      res.end();
    } else if (json) {
      res.status(status).json(json);
    }
  }
}
