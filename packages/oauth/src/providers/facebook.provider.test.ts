import {
  createFacebookProvider,
  getFacebookDefaultScopes,
  fetchFacebookUser,
} from './facebook.provider';

jest.mock('arctic', () => ({
  Facebook: jest.fn().mockImplementation(() => ({})),
}));

describe('Facebook Provider', () => {
  const config = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.com/callback',
  };

  describe('createFacebookProvider', () => {
    it('should create provider instance', () => {
      const provider = createFacebookProvider(config);
      expect(provider).toBeDefined();
    });
  });

  describe('getFacebookDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = getFacebookDefaultScopes();
      expect(scopes).toContain('email');
      expect(scopes).toContain('public_profile');
    });
  });

  describe('fetchFacebookUser', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch and map user data with nested picture', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'fb-123',
            email: 'user@fb.com',
            name: 'FB User',
            picture: { data: { url: 'https://fb.com/pic.jpg' } },
          }),
      });

      const user = await fetchFacebookUser('access-token');

      expect(user.id).toBe('fb-123');
      expect(user.email).toBe('user@fb.com');
      expect(user.name).toBe('FB User');
      expect(user.picture).toBe('https://fb.com/pic.jpg');
    });

    it('should handle missing picture', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'fb-456',
            name: 'No Pic User',
          }),
      });

      const user = await fetchFacebookUser('access-token');

      expect(user.picture).toBeNull();
    });

    it('should throw on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(fetchFacebookUser('bad-token')).rejects.toThrow('Failed to fetch Facebook user');
    });
  });
});
