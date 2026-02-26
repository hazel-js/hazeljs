# @hazeljs/ops-agent

**Ops Agent** — AI-powered DevOps assistant for Jira, Slack, and incident coordination.

[![npm version](https://img.shields.io/npm/v/@hazeljs/ops-agent.svg)](https://www.npmjs.com/package/@hazeljs/ops-agent)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/ops-agent)](https://www.npmjs.com/package/@hazeljs/ops-agent)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview

When you need an AI assistant that can create Jira tickets, post to Slack, and coordinate incidents, use this package. It provides:

- **OpsAgent** – `@Agent` with tools for Jira (create, comment, get) and Slack (post)
- **createOpsRuntime** – wires AI + Agent + tools together
- **Adapters** – `createJiraTool`, `createSlackTool` for Jira Cloud and Slack Web API

## Installation

```bash
npm install @hazeljs/ops-agent @hazeljs/ai @hazeljs/agent @hazeljs/rag
```

## Quick Start

```ts
import { AIEnhancedService } from '@hazeljs/ai';
import {
  createOpsRuntime,
  runOpsAgent,
  createJiraTool,
  createSlackTool,
} from '@hazeljs/ops-agent';

// Configure tools (uses env vars when omitted)
const jiraTool = createJiraTool(); // JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN
const slackTool = createSlackTool(); // SLACK_BOT_TOKEN

const runtime = createOpsRuntime({
  aiService: new AIEnhancedService(),
  tools: {
    jira: jiraTool,
    slack: slackTool,
  },
  model: 'gpt-4',
});

const result = await runOpsAgent(runtime, {
  input: 'Create a Jira ticket in PROJ for "Payment API timeout in prod" and post a summary to #incidents',
  sessionId: 'incident-2024-01',
});

console.log(result.response);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JIRA_HOST` | Jira host (e.g. https://your-domain.atlassian.net) |
| `JIRA_EMAIL` | Email for Basic auth |
| `JIRA_API_TOKEN` | API token from [Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `SLACK_BOT_TOKEN` | Slack bot token (xoxb-...) from app OAuth |

When not configured, tools return placeholder responses so you can develop without credentials.

## Tools

| Tool | Description | Approval |
|------|-------------|----------|
| `create_jira_ticket` | Create Jira issue (project, summary, description, type) | Yes |
| `add_jira_comment` | Add comment to existing issue | No |
| `get_jira_ticket` | Get issue details by key | No |
| `post_to_slack` | Post message to channel (optionally in thread) | Yes |

## Memory

The ops agent has memory enabled by default (in-memory `BufferMemory`). Use the same `sessionId` for follow-up requests in the same incident.

## Human-in-the-Loop

`create_jira_ticket` and `post_to_slack` use `requiresApproval: true`. Subscribe to `tool.approval.requested` and approve/reject before the action runs:

```ts
runtime.on('tool.approval.requested', (event) => {
  // Approve: runtime.approveToolExecution(event.data.requestId, userId);
  // Reject: runtime.rejectToolExecution(event.data.requestId);
});
```

## License

Apache 2.0
