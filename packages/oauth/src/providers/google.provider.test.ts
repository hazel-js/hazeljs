import { createGoogleProvider, getGoogleDefaultScopes, fetchGoogleUser } from './google.provider';

jest.mock('arctic', () => ({
  Google: jest.fn().mockImplementation(() => ({})),
}));

describe('Google Provider', () => {
  const config = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.com/callback',
  };

  describe('createGoogleProvider', () => {
    it('should create provider instance', () => {
      const provider = createGoogleProvider(config);
      expect(provider).toBeDefined();
    });
  });

  describe('getGoogleDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = getGoogleDefaultScopes();
      expect(scopes).toContain('openid');
      expect(scopes).toContain('profile');
      expect(scopes).toContain('email');
    });
  });

  describe('fetchGoogleUser', () => {
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
            sub: 'google-123',
            email: 'user@gmail.com',
            name: 'Google User',
            picture: 'https://google.com/photo.jpg',
          }),
      });

      const user = await fetchGoogleUser('access-token');

      expect(user.id).toBe('google-123');
      expect(user.email).toBe('user@gmail.com');
      expect(user.name).toBe('Google User');
      expect(user.picture).toBe('https://google.com/photo.jpg');
    });

    it('should handle missing optional fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sub: 'google-456',
          }),
      });

      const user = await fetchGoogleUser('access-token');

      expect(user.id).toBe('google-456');
      expect(user.email).toBe('');
      expect(user.name).toBeNull();
      expect(user.picture).toBeNull();
    });

    it('should throw on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(fetchGoogleUser('bad-token')).rejects.toThrow('Failed to fetch Google user');
    });
  });
});
