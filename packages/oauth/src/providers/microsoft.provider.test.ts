import {
  createMicrosoftProvider,
  getMicrosoftDefaultScopes,
  fetchMicrosoftUser,
} from './microsoft.provider';

jest.mock('arctic', () => ({
  MicrosoftEntraId: jest.fn().mockImplementation(() => ({})),
}));

describe('Microsoft Provider', () => {
  const config = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.com/callback',
  };

  describe('createMicrosoftProvider', () => {
    it('should create provider with common tenant by default', () => {
      const provider = createMicrosoftProvider(config);
      expect(provider).toBeDefined();
    });

    it('should create provider with custom tenant', () => {
      const provider = createMicrosoftProvider({
        ...config,
        tenant: 'my-tenant-id',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('getMicrosoftDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = getMicrosoftDefaultScopes();
      expect(scopes).toContain('openid');
      expect(scopes).toContain('profile');
      expect(scopes).toContain('email');
    });
  });

  describe('fetchMicrosoftUser', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch and map user data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'ms-123',
            email: 'user@outlook.com',
            name: 'MS User',
            picture: 'https://graph.microsoft.com/photo',
          }),
      });

      const user = await fetchMicrosoftUser('access-token');

      expect(user.id).toBe('ms-123');
      expect(user.email).toBe('user@outlook.com');
      expect(user.name).toBe('MS User');
    });

    it('should throw on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(fetchMicrosoftUser('bad-token')).rejects.toThrow(
        'Failed to fetch Microsoft user'
      );
    });
  });
});
