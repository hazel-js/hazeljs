import {
  createTwitterProvider,
  getTwitterDefaultScopes,
  fetchTwitterUser,
} from './twitter.provider';

jest.mock('arctic', () => ({
  Twitter: jest.fn().mockImplementation(() => ({})),
}));

describe('Twitter Provider', () => {
  const config = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.com/callback',
  };

  describe('createTwitterProvider', () => {
    it('should create provider with client secret', () => {
      const provider = createTwitterProvider(config);
      expect(provider).toBeDefined();
    });

    it('should create provider without client secret', () => {
      const provider = createTwitterProvider({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('getTwitterDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = getTwitterDefaultScopes();
      expect(scopes).toContain('users.read');
      expect(scopes).toContain('tweet.read');
    });
  });

  describe('fetchTwitterUser', () => {
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
            data: {
              id: 'tw-999',
              name: 'Twitter User',
              username: 'twuser',
              profile_image_url: 'https://twitter.com/pic.png',
            },
          }),
      });

      const user = await fetchTwitterUser('access-token');

      expect(user.id).toBe('tw-999');
      expect(user.name).toBe('Twitter User');
      expect(user.email).toBe('');
      expect(user.picture).toBe('https://twitter.com/pic.png');
    });

    it('should throw when no user data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(fetchTwitterUser('bad-token')).rejects.toThrow(
        'Twitter API returned no user data'
      );
    });

    it('should throw on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(fetchTwitterUser('bad-token')).rejects.toThrow('Failed to fetch Twitter user');
    });
  });
});
