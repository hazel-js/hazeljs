import { OAuthModule } from './oauth.module';
import { OAuthService } from './oauth.service';

jest.mock('arctic', () => ({
  generateState: jest.fn(() => 'state'),
  generateCodeVerifier: jest.fn(() => 'verifier'),
  Google: jest.fn().mockImplementation(() => ({
    createAuthorizationURL: () => new URL('https://accounts.google.com/auth'),
    validateAuthorizationCode: jest.fn(),
  })),
  MicrosoftEntraId: jest.fn(),
  Twitter: jest.fn(),
  GitHub: jest.fn(),
  Facebook: jest.fn(),
}));

describe('OAuthModule', () => {
  const testOptions = {
    providers: {
      google: {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectUri: 'https://app.com/callback',
      },
    },
  };

  beforeEach(() => {
    OAuthModule.forRoot(testOptions);
  });

  it('should return OAuthModule from forRoot', () => {
    const result = OAuthModule.forRoot(testOptions);
    expect(result).toBe(OAuthModule);
  });

  it('should configure OAuthService when forRoot is called', () => {
    const service = new OAuthService();
    expect(service).toBeInstanceOf(OAuthService);
    const url = service.getAuthorizationUrl('google');
    expect(url.url).toBeDefined();
  });
});
