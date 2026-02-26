/**
 * Ops Agent - AI-powered DevOps assistant for Jira, Slack, and incident coordination.
 * Uses @Agent and @Tool decorators from @hazeljs/agent.
 */

import { Agent, Tool } from '@hazeljs/agent';
import type { OpsAgentToolsConfig } from './types';

@Agent({
  name: 'ops-agent',
  description: 'DevOps/SRE assistant for Jira tickets, Slack notifications, and incident triage',
  systemPrompt: `You are an expert DevOps and SRE assistant. You help engineers with:
- Creating and updating Jira tickets
- Posting messages to Slack channels
- Coordinating incident response and follow-ups

When creating tickets or posting to Slack, be concise and include relevant context.
Always confirm what you did (e.g. "Created JIRA-123" or "Posted to #incidents").
If credentials are not configured, you'll get placeholder responses - inform the user they need to set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, and SLACK_BOT_TOKEN.`,
  maxSteps: 12,
  temperature: 0.2,
  enableMemory: true,
})
export class OpsAgent {
  constructor(private tools: OpsAgentToolsConfig) {}

  @Tool({
    name: 'create_jira_ticket',
    description: 'Create a new Jira issue (task, bug, or story)',
    requiresApproval: true,
    parameters: [
      {
        name: 'project',
        type: 'string',
        description: 'Jira project key (e.g. PROJ)',
        required: true,
      },
      { name: 'summary', type: 'string', description: 'Issue summary/title', required: true },
      {
        name: 'description',
        type: 'string',
        description: 'Optional detailed description',
        required: false,
      },
      {
        name: 'issueType',
        type: 'string',
        description: 'Issue type: Task, Bug, Story (default: Task)',
        required: false,
      },
      { name: 'labels', type: 'array', description: 'Optional labels', required: false },
    ],
  })
  async createJiraTicket(input: {
    project: string;
    summary: string;
    description?: string;
    issueType?: string;
    labels?: string[];
  }): Promise<{ key: string; id: string; url?: string }> {
    return this.tools.jira.createTicket(input);
  }

  @Tool({
    name: 'add_jira_comment',
    description: 'Add a comment to an existing Jira issue',
    parameters: [
      {
        name: 'issueKey',
        type: 'string',
        description: 'Jira issue key (e.g. PROJ-123)',
        required: true,
      },
      { name: 'body', type: 'string', description: 'Comment text', required: true },
    ],
  })
  async addJiraComment(input: { issueKey: string; body: string }): Promise<{ id: string }> {
    return this.tools.jira.addComment(input);
  }

  @Tool({
    name: 'get_jira_ticket',
    description: 'Get details of a Jira issue by key',
    parameters: [
      {
        name: 'issueKey',
        type: 'string',
        description: 'Jira issue key (e.g. PROJ-123)',
        required: true,
      },
    ],
  })
  async getJiraTicket(input: { issueKey: string }): Promise<{
    key: string;
    summary: string;
    status?: string;
    description?: string;
    url?: string;
  }> {
    return this.tools.jira.getTicket(input);
  }

  @Tool({
    name: 'post_to_slack',
    description: 'Post a message to a Slack channel (optionally in a thread)',
    requiresApproval: true,
    parameters: [
      {
        name: 'channel',
        type: 'string',
        description: 'Channel name or ID (e.g. #incidents or C123456)',
        required: true,
      },
      { name: 'text', type: 'string', description: 'Message text', required: true },
      {
        name: 'threadTs',
        type: 'string',
        description: 'Optional thread timestamp to reply in thread',
        required: false,
      },
    ],
  })
  async postToSlack(input: {
    channel: string;
    text: string;
    threadTs?: string;
  }): Promise<{ ts: string; channel: string }> {
    return this.tools.slack.postToChannel(input);
  }
}
