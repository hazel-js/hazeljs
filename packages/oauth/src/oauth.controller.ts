import { Controller, Get, Param, Query, Res, Req, type Response, Post, Body } from '@hazeljs/core';
import { OAuthService } from './oauth.service';
import type { SupportedProvider } from './providers/provider.types';
import {
  SAML_REQ_COOKIE,
  buildClearSamlReqCookie,
  buildSamlReqSetCookie,
  signSamlRequestBinding,
  verifySamlRequestBinding,
} from './saml-request-binding';

const STATE_COOKIE = 'oauth_state';
const CODE_VERIFIER_COOKIE = 'oauth_code_verifier';
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes
const COOKIE_OPTS = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
const OAUTH_PROVIDERS: SupportedProvider[] = [
  'google',
  'microsoft',
  'github',
  'facebook',
  'twitter',
];

function getCookie(
  req: { headers?: Record<string, string | string[] | undefined> },
  name: string
): string | undefined {
  const h = req?.headers?.['cookie'];
  const cookieHeader = Array.isArray(h) ? h[0] : h;
  if (typeof cookieHeader !== 'string') return undefined;
  const part = cookieHeader.split(';').find((c) => c.trim().startsWith(`${name}=`));
  if (!part) return undefined;
  const raw = part.slice(part.indexOf('=') + 1).trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
    if (!OAUTH_PROVIDERS.includes(p)) {
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
    if (!OAUTH_PROVIDERS.includes(p)) {
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

      // Pass through callbackHandler (if configured) so the app can issue a JWT,
      // look up the user in its own DB, etc. before responding.
      const response = await this.oauthService.executeCallback(p, result);

      if (query.successRedirect) {
        res.status(302);
        res.setHeader('Location', query.successRedirect);
        res.end();
        return;
      }

      res.status(200).json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth callback failed';
      this.redirectOrJson(res, 401, query.errorRedirect, { error: message });
    }
  }

  /**
   * GET /auth/saml/:idp - Redirects user to SAML IdP login.
   * Binds AuthnRequest ID (+ RelayState) in a signed httpOnly cookie for ACS correlation.
   */
  @Get('/saml/:idp')
  async samlLogin(
    @Param('idp') idp: string,
    @Query() query: { relayState?: string },
    @Res() res: Response
  ): Promise<void> {
    try {
      const { url, requestId, relayState } = this.oauthService.getSamlAuthorizationUrl(
        idp,
        query.relayState
      );
      const signed = signSamlRequestBinding(OAuthService.getOptions(), {
        requestId,
        relayState,
      });
      (res.setHeader as (n: string, v: string | string[]) => void)(
        'Set-Cookie',
        buildSamlReqSetCookie(signed)
      );
      res.status(302);
      res.setHeader('Location', url);
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate SAML login';
      res.status(400).json({ error: message });
    }
  }

  /**
   * POST /auth/saml/:idp/callback - Handles SAML ACS callback.
   * Requires the saml_req cookie from login; rejects unsolicited responses.
   */
  @Post('/saml/:idp/callback')
  async samlCallback(
    @Param('idp') idp: string,
    @Body()
    body: {
      SAMLResponse?: string;
      RelayState?: string;
      successRedirect?: string;
      errorRedirect?: string;
    },
    @Req() req: { headers?: Record<string, string | string[] | undefined> },
    @Res() res: Response
  ): Promise<void> {
    const samlResponse = body?.SAMLResponse;
    if (!samlResponse) {
      this.redirectOrJson(res, 400, body?.errorRedirect, { error: 'Missing SAMLResponse' });
      return;
    }

    const binding = verifySamlRequestBinding(
      OAuthService.getOptions(),
      getCookie(req, SAML_REQ_COOKIE)
    );

    (res.setHeader as (n: string, v: string | string[]) => void)(
      'Set-Cookie',
      buildClearSamlReqCookie()
    );

    if (!binding) {
      this.redirectOrJson(res, 401, body?.errorRedirect, {
        error: 'Missing or invalid SAML AuthnRequest binding',
      });
      return;
    }

    try {
      const result = this.oauthService.handleSamlCallback(idp, samlResponse, {
        expectedRequestId: binding.requestId,
        relayState: body?.RelayState,
        expectedRelayState: binding.relayState,
      });
      const response = await this.oauthService.executeCallback(`saml:${idp}`, result);

      if (body.successRedirect) {
        res.status(302);
        res.setHeader('Location', body.successRedirect);
        res.end();
        return;
      }

      res.status(200).json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SAML callback failed';
      this.redirectOrJson(res, 401, body?.errorRedirect, { error: message });
    }
  }

  /**
   * GET /auth/saml/:idp/metadata - Exposes minimal SP metadata.
   */
  @Get('/saml/:idp/metadata')
  async samlMetadata(@Param('idp') idp: string, @Res() res: Response): Promise<void> {
    try {
      const xml = this.oauthService.getSamlMetadata(idp);
      res.setHeader('Content-Type', 'application/samlmetadata+xml; charset=utf-8');
      res.status(200).send(xml);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SAML metadata unavailable';
      res.status(404).json({ error: message });
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
