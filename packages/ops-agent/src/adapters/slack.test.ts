/**
 * Slack adapter tests
 */

import { createSlackTool } from './slack';

describe('createSlackTool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SLACK_BOT_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('placeholder mode (no token)', () => {
    it('returns placeholder tool when token is not set', () => {
      const tool = createSlackTool();
      expect(tool).toBeDefined();
      expect(tool.postToChannel).toBeDefined();
    });

    it('postToChannel returns placeholder ts and channel', async () => {
      const tool = createSlackTool();
      const result = await tool.postToChannel({
        channel: '#incidents',
        text: 'Test message',
      });
      expect(result.ts).toMatch(/^ts-\d+$/);
      expect(result.channel).toBe('#incidents');
    });

    it('postToChannel preserves channel when replying in thread', async () => {
      const tool = createSlackTool();
      const result = await tool.postToChannel({
        channel: 'C123456',
        text: 'Reply',
        threadTs: '1234567890.123456',
      });
      expect(result.channel).toBe('C123456');
    });

    it('returns placeholder when config is empty', () => {
      const tool = createSlackTool({});
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

    it('postToChannel calls Slack API and returns ts/channel', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          ts: '1234567890.123456',
          channel: 'C123456',
        }),
      });

      const tool = createSlackTool({
        token: 'xoxb-test-token',
      });

      const result = await tool.postToChannel({
        channel: '#incidents',
        text: 'Incident update',
      });

      expect(result.ts).toBe('1234567890.123456');
      expect(result.channel).toBe('C123456');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            channel: '#incidents',
            text: 'Incident update',
          }),
        })
      );
    });

    it('postToChannel includes thread_ts when provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: 'ts-1', channel: 'C123' }),
      });

      const tool = createSlackTool({ token: 'xoxb-token' });

      await tool.postToChannel({
        channel: '#incidents',
        text: 'Reply',
        threadTs: '1234567890.123456',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          body: JSON.stringify({
            channel: '#incidents',
            text: 'Reply',
            thread_ts: '1234567890.123456',
          }),
        })
      );
    });

    it('postToChannel throws when HTTP not ok', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const tool = createSlackTool({ token: 'xoxb-token' });

      await expect(tool.postToChannel({ channel: '#incidents', text: 'Test' })).rejects.toThrow(
        'Slack post failed: 500'
      );
    });

    it('postToChannel throws when Slack API returns ok: false', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' }),
      });

      const tool = createSlackTool({ token: 'xoxb-token' });

      await expect(tool.postToChannel({ channel: '#nonexistent', text: 'Test' })).rejects.toThrow(
        'Slack API error: channel_not_found'
      );
    });

    it('uses env var when config not provided', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-env-token';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: 'ts-1', channel: 'C1' }),
      });

      const tool = createSlackTool();
      await tool.postToChannel({ channel: '#test', text: 'Test' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer xoxb-env-token',
          }),
        })
      );
    });
  });
});
