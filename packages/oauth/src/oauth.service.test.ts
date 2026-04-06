import { OAuthService } from './oauth.service';
import * as arctic from 'arctic';

jest.mock('arctic', () => ({
  generateState: jest.fn(() => 'mock-state-123'),
  generateCodeVerifier: jest.fn(() => 'mock-code-verifier-456'),
  Google: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: (state: string, _cv: string, scopes: string[]) =>
      new URL(
        `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&scope=${scopes.join(' ')}`
      ),
    validateAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: () => 'mock-access-token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock-refresh-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    }),
  })),
  MicrosoftEntraId: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: (state: string, _cv: string, scopes: string[]) =>
      new URL(
        `https://login.microsoftonline.com/oauth2/v2.0/authorize?state=${state}&scope=${scopes.join(' ')}`
      ),
    validateAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: () => 'mock-access-token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock-refresh-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    }),
  })),
  Twitter: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: (state: string, _cv: string, scopes: string[]) =>
      new URL(`https://twitter.com/i/oauth2/authorize?state=${state}&scope=${scopes.join(' ')}`),
    validateAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: () => 'mock-access-token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock-refresh-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    }),
  })),
  GitHub: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: (state: string, scopes: string[]) =>
      new URL(`https://github.com/login/oauth/authorize?state=${state}&scope=${scopes.join(' ')}`),
    validateAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: () => 'mock-access-token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock-refresh-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    }),
  })),
  Facebook: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: (state: string, scopes: string[]) =>
      new URL(`https://facebook.com/v18.0/dialog/oauth?state=${state}&scope=${scopes.join(',')}`),
    validateAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: () => 'mock-access-token',
      hasRefreshToken: () => true,
      refreshToken: () => 'mock-refresh-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    }),
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OAuthService', () => {
  const baseConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'https://app.com/callback',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    OAuthService.configure({
      providers: {
        google: { ...baseConfig },
        github: { ...baseConfig },
        facebook: { ...baseConfig },
        microsoft: { ...baseConfig },
        twitter: { ...baseConfig },
        saml: {
          'okta-main': {
            idpKey: 'okta-main',
            ssoUrl: 'https://idp.example.com/sso',
            issuer: 'https://app.example.com',
            acsUrl: 'https://app.example.com/auth/saml/okta-main/callback',
            audience: 'https://app.example.com',
          },
        },
      },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.png',
        }),
    });
  });

  describe('configure and getOptions', () => {
    it('should throw when not configured', () => {
      (OAuthService as unknown as { options: null }).options = null;
      expect(() => new OAuthService()).toThrow('OAuthModule not configured');
      OAuthService.configure({ providers: { google: baseConfig } });
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return URL with state for GitHub (no PKCE)', () => {
      const service = new OAuthService();
      const result = service.getAuthorizationUrl('github');

      expect(result.url).toContain('github.com');
      expect(result.state).toBe('mock-state-123');
      expect(result.codeVerifier).toBeUndefined();
      expect(arctic.generateState).toHaveBeenCalled();
    });

    it('should return URL with state and codeVerifier for Google (PKCE)', () => {
      const service = new OAuthService();
      const result = service.getAuthorizationUrl('google');

      expect(result.url).toContain('accounts.google.com');
      expect(result.state).toBe('mock-state-123');
      expect(result.codeVerifier).toBe('mock-code-verifier-456');
      expect(arctic.generateCodeVerifier).toHaveBeenCalled();
    });

    it('should use provided state when given', () => {
      const service = new OAuthService();
      const result = service.getAuthorizationUrl('github', 'custom-state');

      expect(result.state).toBe('custom-state');
      expect(result.url).toContain('custom-state');
    });

    it('should use custom scopes when provided', () => {
      const service = new OAuthService();
      const result = service.getAuthorizationUrl('github', undefined, ['user:email', 'repo']);

      expect(result.url).toMatch(/user:email|user%3Aemail/);
      expect(result.url).toContain('repo');
    });

    it('should throw for unconfigured provider', () => {
      OAuthService.configure({ providers: { google: baseConfig } });
      const service = new OAuthService();
      expect(() => service.getAuthorizationUrl('github')).toThrow('GitHub OAuth is not configured');
    });
  });

  describe('validateState', () => {
    it('should return true when states match', () => {
      const service = new OAuthService();
      expect(service.validateState('abc123', 'abc123')).toBe(true);
    });

    it('should return false when states differ', () => {
      const service = new OAuthService();
      expect(service.validateState('abc123', 'xyz789')).toBe(false);
    });

    it('should return false when received state is empty', () => {
      const service = new OAuthService();
      expect(service.validateState('', 'stored')).toBe(false);
    });
  });

  describe('generateState', () => {
    it('should return generated state', () => {
      const service = new OAuthService();
      const state = service.generateState();
      expect(state).toBe('mock-state-123');
      expect(arctic.generateState).toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    it('should exchange code and fetch user for GitHub', async () => {
      const service = new OAuthService();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 12345,
            email: 'github@example.com',
            name: 'GitHub User',
            avatar_url: 'https://github.com/avatar.png',
          }),
      });

      const result = await service.handleCallback('github', 'auth-code', 'mock-state-123');

      expect(result.protocol).toBe('oauth2');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.id).toBe('12345');
      expect(result.user.email).toBe('github@example.com');
      expect(result.user.name).toBe('GitHub User');
      expect(result.user.picture).toBe('https://github.com/avatar.png');
    });

    it('should require codeVerifier for Google (PKCE)', async () => {
      const service = new OAuthService();
      await expect(service.handleCallback('google', 'code', 'state')).rejects.toThrow(
        'requires codeVerifier'
      );
    });

    it('should exchange code with codeVerifier for Google', async () => {
      const service = new OAuthService();
      const result = await service.handleCallback(
        'google',
        'auth-code',
        'mock-state-123',
        'mock-code-verifier-456'
      );

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should fetch Facebook user with correct API', async () => {
      const service = new OAuthService();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'fb-123',
            email: 'fb@example.com',
            name: 'FB User',
            picture: { data: { url: 'https://fb.com/pic.png' } },
          }),
      });

      const result = await service.handleCallback('facebook', 'code', 'state');

      expect(result.user.id).toBe('fb-123');
      expect(result.user.picture).toBe('https://fb.com/pic.png');
    });

    it('should fetch Twitter user (no email from API v2)', async () => {
      const service = new OAuthService();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'tw-123',
              name: 'Twitter User',
              username: 'twuser',
              profile_image_url: 'https://twitter.com/pic.png',
            },
          }),
      });

      const result = await service.handleCallback('twitter', 'code', 'state', 'code-verifier');

      expect(result.user.id).toBe('tw-123');
      expect(result.user.email).toBe('');
      expect(result.user.name).toBe('Twitter User');
    });

    it('should throw for unconfigured provider', async () => {
      OAuthService.configure({ providers: { google: baseConfig } });
      const service = new OAuthService();
      await expect(service.handleCallback('facebook', 'code', 'state')).rejects.toThrow(
        'Facebook OAuth is not configured'
      );
    });
  });

  describe('SAML support', () => {
    it('returns SAML authorization URL for configured IdP', () => {
      const service = new OAuthService();
      const result = service.getSamlAuthorizationUrl('okta-main');
      expect(result.url).toContain('idp.example.com/sso');
      expect(result.url).toContain('SAMLRequest=');
      expect(result.requestId).toMatch(/^_/);
    });

    it('throws for unknown SAML provider key', () => {
      const service = new OAuthService();
      expect(() => service.getSamlAuthorizationUrl('unknown-idp')).toThrow('not configured');
    });

    it('returns provider keys for configured SAML providers', () => {
      const service = new OAuthService();
      expect(service.getSamlProviderKeys()).toContain('okta-main');
    });

    it('returns metadata XML for configured SAML provider', () => {
      const service = new OAuthService();
      const xml = service.getSamlMetadata('okta-main');
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('AssertionConsumerService');
    });

    it('parses successful SAML callback payload', () => {
      const service = new OAuthService();
      const samlResponseXml = `
        <samlp:Response InResponseTo="_req123">
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
          </samlp:Status>
          <saml:Assertion>
            <saml:Conditions>
              <saml:AudienceRestriction>
                <saml:Audience>https://app.example.com</saml:Audience>
              </saml:AudienceRestriction>
            </saml:Conditions>
            <saml:Subject>
              <saml:NameID>user-001</saml:NameID>
            </saml:Subject>
            <saml:AuthnStatement SessionIndex="session-1"/>
            <saml:AttributeStatement>
              <saml:Attribute Name="email">
                <saml:AttributeValue>user@example.com</saml:AttributeValue>
              </saml:Attribute>
              <saml:Attribute Name="name">
                <saml:AttributeValue>Saml User</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
          </saml:Assertion>
        </samlp:Response>
      `;
      const encoded = Buffer.from(samlResponseXml, 'utf8').toString('base64');
      const result = service.handleSamlCallback('okta-main', encoded, 'relay-123');
      expect(result.protocol).toBe('saml');
      expect(result.user.email).toBe('user@example.com');
      expect(result.nameId).toBe('user-001');
      expect(result.relayState).toBe('relay-123');
    });

    it('throws when SAML callback is unsuccessful', () => {
      const service = new OAuthService();
      const badXml = `
        <samlp:Response>
          <samlp:Status>
            <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Requester"/>
          </samlp:Status>
        </samlp:Response>
      `;
      const encoded = Buffer.from(badXml, 'utf8').toString('base64');
      expect(() => service.handleSamlCallback('okta-main', encoded)).toThrow('not successful');
    });
  });
});
