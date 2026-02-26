/**
 * Jira adapter tests
 */

import { createJiraTool } from './jira';

describe('createJiraTool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('placeholder mode (no credentials)', () => {
    it('returns placeholder tool when env vars are not set', () => {
      const tool = createJiraTool();
      expect(tool).toBeDefined();
      expect(tool.createTicket).toBeDefined();
      expect(tool.addComment).toBeDefined();
      expect(tool.getTicket).toBeDefined();
    });

    it('createTicket returns placeholder key with project and timestamp', async () => {
      const tool = createJiraTool();
      const result = await tool.createTicket({
        project: 'PROJ',
        summary: 'Test issue',
      });
      expect(result.key).toMatch(/^PROJ-\d+$/);
      expect(result.id).toBe(result.key);
      expect(result.url).toContain('example.atlassian.net');
      expect(result.url).toContain(result.key);
    });

    it('addComment returns placeholder id', async () => {
      const tool = createJiraTool();
      const result = await tool.addComment({
        issueKey: 'PROJ-123',
        body: 'Test comment',
      });
      expect(result.id).toMatch(/^comment-\d+$/);
    });

    it('getTicket returns placeholder with issueKey', async () => {
      const tool = createJiraTool();
      const result = await tool.getTicket({ issueKey: 'PROJ-123' });
      expect(result.key).toBe('PROJ-123');
      expect(result.summary).toContain('Placeholder');
      expect(result.status).toBe('Unknown');
    });

    it('returns placeholder when config is empty', () => {
      const tool = createJiraTool({});
      expect(tool).toBeDefined();
    });

    it('returns placeholder when config has empty strings', () => {
      const tool = createJiraTool({ host: '', email: '', apiToken: '' });
      expect(tool).toBeDefined();
    });
  });

  describe('real mode (with mocked fetch)', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      fetchMock = jest.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it('createTicket calls Jira API and returns issue', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ key: 'PROJ-42', id: '12345' }),
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token',
      });

      const result = await tool.createTicket({
        project: 'PROJ',
        summary: 'DB issue',
        description: 'Connection pool exhaustion',
      });

      expect(result.key).toBe('PROJ-42');
      expect(result.id).toBe('12345');
      expect(result.url).toBe('https://test.atlassian.net/browse/PROJ-42');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('createTicket throws when API fails', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'bad',
      });

      await expect(tool.createTicket({ project: 'PROJ', summary: 'Test' })).rejects.toThrow(
        'Jira create issue failed: 401'
      );
    });

    it('addComment calls Jira API and returns comment id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'comment-1' }),
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token',
      });

      const result = await tool.addComment({
        issueKey: 'PROJ-123',
        body: 'Status update',
      });

      expect(result.id).toBe('comment-1');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/PROJ-123/comment',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('getTicket fetches issue and returns parsed fields', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          key: 'PROJ-123',
          fields: {
            summary: 'Test issue',
            status: { name: 'In Progress' },
            description: {
              content: [{ content: [{ text: 'Description text' }] }],
            },
          },
        }),
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token',
      });

      const result = await tool.getTicket({ issueKey: 'PROJ-123' });

      expect(result.key).toBe('PROJ-123');
      expect(result.summary).toBe('Test issue');
      expect(result.status).toBe('In Progress');
      expect(result.description).toBe('Description text');
      expect(result.url).toBe('https://test.atlassian.net/browse/PROJ-123');
    });

    it('getTicket throws 404 when issue not found', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'token',
      });

      await expect(tool.getTicket({ issueKey: 'PROJ-999' })).rejects.toThrow(
        'Jira issue not found: PROJ-999'
      );
    });

    it('strips trailing slash from host', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'PROJ-1', id: '1' }),
      });

      const tool = createJiraTool({
        host: 'https://test.atlassian.net/',
        email: 'test@example.com',
        apiToken: 'token',
      });

      await tool.createTicket({ project: 'PROJ', summary: 'Test' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue',
        expect.any(Object)
      );
    });

    it('uses env vars when config not provided', async () => {
      process.env.JIRA_HOST = 'https://env.atlassian.net';
      process.env.JIRA_EMAIL = 'env@example.com';
      process.env.JIRA_API_TOKEN = 'env-token';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'PROJ-1', id: '1' }),
      });

      const tool = createJiraTool();
      await tool.createTicket({ project: 'PROJ', summary: 'Test' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://env.atlassian.net/rest/api/3/issue',
        expect.any(Object)
      );
    });
  });
});
