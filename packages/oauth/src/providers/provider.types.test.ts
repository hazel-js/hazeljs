import type {
  BaseProviderConfig,
  GoogleProviderConfig,
  MicrosoftProviderConfig,
  OAuthUser,
  OAuthCallbackResult,
  OAuthAuthorizationResult,
  SupportedProvider,
} from './provider.types';

describe('Provider Types', () => {
  it('should allow valid BaseProviderConfig', () => {
    const config: BaseProviderConfig = {
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.com/cb',
    };
    expect(config.clientId).toBe('id');
  });

  it('should allow GoogleProviderConfig', () => {
    const config: GoogleProviderConfig = {
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.com/cb',
    };
    expect(config).toBeDefined();
  });

  it('should allow MicrosoftProviderConfig with optional tenant', () => {
    const config: MicrosoftProviderConfig = {
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.com/cb',
      tenant: 'common',
    };
    expect(config.tenant).toBe('common');
  });

  it('should define OAuthUser shape', () => {
    const user: OAuthUser = {
      id: '123',
      email: 'a@b.com',
      name: 'User',
      picture: 'https://pic.com',
    };
    expect(user.id).toBe('123');
  });

  it('should define OAuthCallbackResult shape', () => {
    const result: OAuthCallbackResult = {
      accessToken: 'token',
      user: { id: '1', email: 'e@e.com', name: 'N' },
    };
    expect(result.accessToken).toBe('token');
  });

  it('should define OAuthAuthorizationResult shape', () => {
    const result: OAuthAuthorizationResult = {
      url: 'https://provider.com',
      state: 'state',
      codeVerifier: 'verifier',
    };
    expect(result.codeVerifier).toBe('verifier');
  });

  it('should include all SupportedProvider values', () => {
    const providers: SupportedProvider[] = ['google', 'microsoft', 'github', 'facebook', 'twitter'];
    expect(providers).toHaveLength(5);
  });
});
