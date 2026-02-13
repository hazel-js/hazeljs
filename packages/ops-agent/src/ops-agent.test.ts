/**
 * OpsAgent tests
 */

import { OpsAgent } from './ops-agent';
import type { OpsAgentToolsConfig } from './types';

function createMockTools(): OpsAgentToolsConfig {
  return {
    jira: {
      createTicket: jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        id: '123',
        url: 'https://jira.example.com/browse/PROJ-123',
      }),
      addComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      getTicket: jest.fn().mockResolvedValue({
        key: 'PROJ-123',
        summary: 'Test issue',
        status: 'In Progress',
        description: 'Desc',
        url: 'https://jira.example.com/browse/PROJ-123',
      }),
    },
    slack: {
      postToChannel: jest.fn().mockResolvedValue({
        ts: '1234567890.123456',
        channel: '#incidents',
      }),
    },
  };
}

describe('OpsAgent', () => {
  let agent: OpsAgent;
  let tools: OpsAgentToolsConfig;

  beforeEach(() => {
    tools = createMockTools();
    agent = new OpsAgent(tools);
  });

  describe('createJiraTicket', () => {
    it('delegates to jira.createTicket', async () => {
      const result = await agent.createJiraTicket({
        project: 'PROJ',
        summary: 'DB issue',
        description: 'Connection pool',
      });

      expect(tools.jira.createTicket).toHaveBeenCalledWith({
        project: 'PROJ',
        summary: 'DB issue',
        description: 'Connection pool',
      });
      expect(result).toEqual({
        key: 'PROJ-123',
        id: '123',
        url: 'https://jira.example.com/browse/PROJ-123',
      });
    });

    it('passes optional fields', async () => {
      await agent.createJiraTicket({
        project: 'PROJ',
        summary: 'Bug',
        description: 'Desc',
        issueType: 'Bug',
        labels: ['incident', 'prod'],
      });

      expect(tools.jira.createTicket).toHaveBeenCalledWith({
        project: 'PROJ',
        summary: 'Bug',
        description: 'Desc',
        issueType: 'Bug',
        labels: ['incident', 'prod'],
      });
    });
  });

  describe('addJiraComment', () => {
    it('delegates to jira.addComment', async () => {
      const result = await agent.addJiraComment({
        issueKey: 'PROJ-123',
        body: 'Status update',
      });

      expect(tools.jira.addComment).toHaveBeenCalledWith({
        issueKey: 'PROJ-123',
        body: 'Status update',
      });
      expect(result).toEqual({ id: 'comment-1' });
    });
  });

  describe('getJiraTicket', () => {
    it('delegates to jira.getTicket', async () => {
      const result = await agent.getJiraTicket({ issueKey: 'PROJ-123' });

      expect(tools.jira.getTicket).toHaveBeenCalledWith({
        issueKey: 'PROJ-123',
      });
      expect(result.key).toBe('PROJ-123');
      expect(result.summary).toBe('Test issue');
      expect(result.status).toBe('In Progress');
    });
  });

  describe('postToSlack', () => {
    it('delegates to slack.postToChannel', async () => {
      const result = await agent.postToSlack({
        channel: '#incidents',
        text: 'Incident PROJ-123 created',
      });

      expect(tools.slack.postToChannel).toHaveBeenCalledWith({
        channel: '#incidents',
        text: 'Incident PROJ-123 created',
      });
      expect(result).toEqual({
        ts: '1234567890.123456',
        channel: '#incidents',
      });
    });

    it('passes threadTs when provided', async () => {
      await agent.postToSlack({
        channel: '#incidents',
        text: 'Reply',
        threadTs: '1234567890.123456',
      });

      expect(tools.slack.postToChannel).toHaveBeenCalledWith({
        channel: '#incidents',
        text: 'Reply',
        threadTs: '1234567890.123456',
      });
    });
  });
});
