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

/**
 * Implement this interface and pass the class to OAuthModule.forRoot({ callbackHandler })
 * to hook into the OAuth callback before the response is sent.
 *
 * The handler is resolved from the DI container, so it can inject any service
 * (JwtService, a UsersRepository, etc.) through its constructor.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class MyOAuthHandler implements OAuthCallbackHandler {
 *   constructor(
 *     private readonly jwtService: JwtService,
 *     private readonly usersRepo: UsersRepository,
 *   ) {}
 *
 *   async handle(result: OAuthCallbackResult, provider: SupportedProvider) {
 *     const user = await this.usersRepo.findOrCreate(result.user);
 *     return { token: this.jwtService.sign({ sub: user.id, role: user.role, tenantId: user.orgId }) };
 *   }
 * }
 * ```
 */
export interface OAuthCallbackHandler {
  handle(result: OAuthCallbackResult, provider: SupportedProvider): Promise<unknown> | unknown;
}

export interface OAuthModuleOptions {
  providers: OAuthProvidersConfig;
  /** Default scopes per provider. Override via getAuthorizationUrl scopes param. */
  defaultScopes?: Partial<Record<SupportedProvider, string[]>>;
  /**
   * Optional class (must be registered in the DI container) whose `handle()` method is
   * called after a successful OAuth callback.  Use it to look up / create the user in
   * your database and return a JWT.  When omitted the raw OAuthCallbackResult is returned.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbackHandler?: new (...args: any[]) => OAuthCallbackHandler;
}
