/**
 * @hazeljs/oauth - OAuth 2.0 social login for HazelJS
 *
 * Supports Google, Microsoft Entra ID, and GitHub.
 * Built on Arctic - 50+ providers available.
 */

export { OAuthModule } from './oauth.module';
export { OAuthService } from './oauth.service';
export { OAuthController } from './oauth.controller';
export { OAuthStateGuard } from './guards/oauth-state.guard';
export type {
  OAuthModuleOptions,
  OAuthProvidersConfig,
  OAuthCallbackHandler,
  OAuthCallbackResult,
  OAuthProtocolCallbackResult,
  OAuthAuthorizationResult,
  OAuthUser,
  SamlUser,
  SamlCallbackResult,
  SupportedProvider,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  GitHubProviderConfig,
  FacebookProviderConfig,
  TwitterProviderConfig,
  SamlProviderConfig,
} from './providers/provider.types';
