import { createGitHubProvider, getGitHubDefaultScopes, fetchGitHubUser } from './github.provider';

jest.mock('arctic', () => ({
  GitHub: jest.fn().mockImplementation(() => ({})),
}));

describe('GitHub Provider', () => {
  const config = {
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'https://app.com/callback',
  };

  describe('createGitHubProvider', () => {
    it('should create provider instance', () => {
      const provider = createGitHubProvider(config);
      expect(provider).toBeDefined();
    });
  });

  describe('getGitHubDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = getGitHubDefaultScopes();
      expect(scopes).toContain('user:email');
    });
  });

  describe('fetchGitHubUser', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should fetch and map user data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 999,
            email: 'dev@github.com',
            name: 'Dev User',
            avatar_url: 'https://github.com/avatar.png',
          }),
      });

      const user = await fetchGitHubUser('access-token');

      expect(user.id).toBe('999');
      expect(user.email).toBe('dev@github.com');
      expect(user.name).toBe('Dev User');
      expect(user.picture).toBe('https://github.com/avatar.png');
    });

    it('should fetch email from emails endpoint when not in user', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 888,
              name: 'No Email User',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { email: 'primary@example.com', primary: true },
              { email: 'other@example.com', primary: false },
            ]),
        });

      const user = await fetchGitHubUser('access-token');

      expect(user.email).toBe('primary@example.com');
    });

    it('should throw on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(fetchGitHubUser('bad-token')).rejects.toThrow('Failed to fetch GitHub user');
    });
  });
});
