import { Injectable } from '@hazeljs/core';
import * as arctic from 'arctic';
import {
  createGoogleProvider,
  createMicrosoftProvider,
  createGitHubProvider,
  createFacebookProvider,
  createTwitterProvider,
  getGoogleDefaultScopes,
  getMicrosoftDefaultScopes,
  getGitHubDefaultScopes,
  getFacebookDefaultScopes,
  getTwitterDefaultScopes,
  fetchGoogleUser,
  fetchMicrosoftUser,
  fetchGitHubUser,
  fetchFacebookUser,
  fetchTwitterUser,
} from './providers';
import type {
  OAuthModuleOptions,
  OAuthCallbackResult,
  OAuthAuthorizationResult,
  SupportedProvider,
  OAuthUser,
} from './providers/provider.types';

const PKCE_PROVIDERS: SupportedProvider[] = ['google', 'microsoft', 'twitter'];

@Injectable()
export class OAuthService {
  private options: OAuthModuleOptions;
  private googleClient: ReturnType<typeof createGoogleProvider> | null = null;
  private microsoftClient: ReturnType<typeof createMicrosoftProvider> | null = null;
  private githubClient: ReturnType<typeof createGitHubProvider> | null = null;
  private facebookClient: ReturnType<typeof createFacebookProvider> | null = null;
  private twitterClient: ReturnType<typeof createTwitterProvider> | null = null;

  constructor() {
    this.options = OAuthService.getOptions();
    this.initClients();
  }

  private static options: OAuthModuleOptions | null = null;

  static configure(options: OAuthModuleOptions): void {
    OAuthService.options = options;
  }

  private static getOptions(): OAuthModuleOptions {
    if (!OAuthService.options) {
      throw new Error(
        'OAuthModule not configured. Call OAuthModule.forRoot({ providers: {...} }) in your app module.'
      );
    }
    return OAuthService.options;
  }

  private initClients(): void {
    if (this.options.providers.google) {
      this.googleClient = createGoogleProvider(this.options.providers.google);
    }
    if (this.options.providers.microsoft) {
      this.microsoftClient = createMicrosoftProvider(this.options.providers.microsoft);
    }
    if (this.options.providers.github) {
      this.githubClient = createGitHubProvider(this.options.providers.github);
    }
    if (this.options.providers.facebook) {
      this.facebookClient = createFacebookProvider(this.options.providers.facebook);
    }
    if (this.options.providers.twitter) {
      this.twitterClient = createTwitterProvider(this.options.providers.twitter);
    }
  }

  private getClient(
    provider: SupportedProvider
  ): NonNullable<
    | ReturnType<typeof createGoogleProvider>
    | ReturnType<typeof createMicrosoftProvider>
    | ReturnType<typeof createGitHubProvider>
    | ReturnType<typeof createFacebookProvider>
    | ReturnType<typeof createTwitterProvider>
  > {
    switch (provider) {
      case 'google':
        if (!this.googleClient) throw new Error('Google OAuth is not configured');
        return this.googleClient;
      case 'microsoft':
        if (!this.microsoftClient) throw new Error('Microsoft OAuth is not configured');
        return this.microsoftClient;
      case 'github':
        if (!this.githubClient) throw new Error('GitHub OAuth is not configured');
        return this.githubClient;
      case 'facebook':
        if (!this.facebookClient) throw new Error('Facebook OAuth is not configured');
        return this.facebookClient;
      case 'twitter':
        if (!this.twitterClient) throw new Error('Twitter OAuth is not configured');
        return this.twitterClient;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getDefaultScopes(provider: SupportedProvider): string[] {
    const defaults = this.options.defaultScopes?.[provider];
    if (defaults) return defaults;
    switch (provider) {
      case 'google':
        return getGoogleDefaultScopes();
      case 'microsoft':
        return getMicrosoftDefaultScopes();
      case 'github':
        return getGitHubDefaultScopes();
      case 'facebook':
        return getFacebookDefaultScopes();
      case 'twitter':
        return getTwitterDefaultScopes();
      default:
        return [];
    }
  }

  /**
   * Get the authorization URL to redirect the user to the OAuth provider.
   * For PKCE providers (Google, Microsoft), store codeVerifier and pass it to handleCallback.
   */
  getAuthorizationUrl(
    provider: SupportedProvider,
    state?: string,
    scopes?: string[]
  ): OAuthAuthorizationResult {
    const client = this.getClient(provider);
    const resolvedState = state || arctic.generateState();
    const resolvedScopes = scopes ?? this.getDefaultScopes(provider);

    if (PKCE_PROVIDERS.includes(provider)) {
      const codeVerifier = arctic.generateCodeVerifier();
      const url = (
        client as { createAuthorizationURL: (s: string, c: string, sc: string[]) => URL }
      ).createAuthorizationURL(resolvedState, codeVerifier, resolvedScopes);
      return {
        url: url.toString(),
        state: resolvedState,
        codeVerifier,
      };
    }

    // GitHub, Facebook - no PKCE
    const url = (
      client as { createAuthorizationURL: (s: string, sc: string[]) => URL }
    ).createAuthorizationURL(resolvedState, resolvedScopes);
    return {
      url: url.toString(),
      state: resolvedState,
    };
  }

  /**
   * Exchange the authorization code for tokens and fetch user profile.
   * For PKCE providers (Google, Microsoft), codeVerifier is required.
   */
  async handleCallback(
    provider: SupportedProvider,
    code: string,
    state: string,
    codeVerifier?: string
  ): Promise<OAuthCallbackResult> {
    const client = this.getClient(provider);
    const needsPkce = PKCE_PROVIDERS.includes(provider);

    if (needsPkce && !codeVerifier) {
      throw new Error(
        `Provider ${provider} requires codeVerifier (PKCE). Pass the codeVerifier from getAuthorizationUrl.`
      );
    }

    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresAt: Date | undefined;

    try {
      if (needsPkce && codeVerifier) {
        const tokens = await (
          client as {
            validateAuthorizationCode: (
              c: string,
              v: string
            ) => Promise<{
              accessToken: () => string;
              hasRefreshToken: () => boolean;
              refreshToken: () => string;
              accessTokenExpiresAt: () => Date;
            }>;
          }
        ).validateAuthorizationCode(code, codeVerifier);
        accessToken = tokens.accessToken();
        refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : undefined;
        expiresAt = tokens.accessTokenExpiresAt();
      } else {
        const tokens = await (
          client as {
            validateAuthorizationCode: (c: string) => Promise<{
              accessToken: () => string;
              hasRefreshToken: () => boolean;
              refreshToken: () => string;
              accessTokenExpiresAt: () => Date;
            }>;
          }
        ).validateAuthorizationCode(code);
        accessToken = tokens.accessToken();
        refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : undefined;
        expiresAt = tokens.accessTokenExpiresAt();
      }
    } catch (e) {
      if (e instanceof arctic.OAuth2RequestError) {
        throw new Error(`OAuth token exchange failed: ${e.code} - ${e.description || e.message}`);
      }
      if (e instanceof arctic.ArcticFetchError) {
        const cause = (e as unknown as { cause?: Error }).cause;
        throw new Error(`OAuth request failed: ${cause?.message || e.message}`);
      }
      throw e;
    }

    let user: OAuthUser;
    switch (provider) {
      case 'google':
        user = await fetchGoogleUser(accessToken);
        break;
      case 'microsoft':
        user = await fetchMicrosoftUser(accessToken);
        break;
      case 'github':
        user = await fetchGitHubUser(accessToken);
        break;
      case 'facebook':
        user = await fetchFacebookUser(accessToken);
        break;
      case 'twitter':
        user = await fetchTwitterUser(accessToken);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      user,
    };
  }

  /**
   * Validate that the state matches (CSRF protection).
   * Use this when handling the callback to ensure the request originated from your app.
   */
  validateState(receivedState: string, storedState: string): boolean {
    return receivedState === storedState && receivedState.length > 0;
  }

  /**
   * Generate a cryptographically secure state value for OAuth.
   */
  generateState(): string {
    return arctic.generateState();
  }
}
