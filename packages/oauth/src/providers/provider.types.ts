/**
 * OAuth provider configuration types
 */

export interface BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type GoogleProviderConfig = BaseProviderConfig;

export interface MicrosoftProviderConfig extends BaseProviderConfig {
  /** Azure AD tenant ID. Use 'common' for multi-tenant. Default: 'common' */
  tenant?: string;
}

export type GitHubProviderConfig = BaseProviderConfig;

export type FacebookProviderConfig = BaseProviderConfig;

export interface TwitterProviderConfig extends Omit<BaseProviderConfig, 'clientSecret'> {
  /** Optional for public clients (PKCE-only) */
  clientSecret?: string | null;
}

export type OAuthProviderConfig =
  | { google: GoogleProviderConfig }
  | { microsoft: MicrosoftProviderConfig }
  | { github: GitHubProviderConfig }
  | { facebook: FacebookProviderConfig }
  | { twitter: TwitterProviderConfig };

export interface OAuthProvidersConfig {
  google?: GoogleProviderConfig;
  microsoft?: MicrosoftProviderConfig;
  github?: GitHubProviderConfig;
  facebook?: FacebookProviderConfig;
  twitter?: TwitterProviderConfig;
}

export type SupportedProvider = 'google' | 'microsoft' | 'github' | 'facebook' | 'twitter';

export interface OAuthUser {
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}

export interface OAuthCallbackResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  user: OAuthUser;
}

export interface OAuthAuthorizationResult {
  url: string;
  state: string;
  /** Required for PKCE providers (Google, Microsoft). Store and pass to handleCallback. */
  codeVerifier?: string;
}

export interface OAuthModuleOptions {
  providers: OAuthProvidersConfig;
  /** Default scopes per provider. Override via getAuthorizationUrl scopes param. */
  defaultScopes?: Partial<Record<SupportedProvider, string[]>>;
}
