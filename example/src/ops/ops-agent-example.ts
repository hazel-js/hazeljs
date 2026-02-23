/**
 * Ops Agent Demo - Jira + Slack
 * AI-powered ops assistant for creating tickets and posting to Slack
 *
 * Run: npm run ops:agent
 * Requires: OPENAI_API_KEY
 * Optional: JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, SLACK_BOT_TOKEN for real integrations
 */

import { AIEnhancedService } from '@hazeljs/ai';
import {
  createOpsRuntime,
  runOpsAgent,
  createJiraTool,
  createSlackTool,
} from '@hazeljs/ops-agent';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Set OPENAI_API_KEY to run the ops agent example');
    process.exit(1);
  }

  console.log('=== Ops Agent Demo (Jira + Slack) ===\n');

  const jiraTool = createJiraTool();
  const slackTool = createSlackTool();

  const runtime = createOpsRuntime({
    aiService: new AIEnhancedService(),
    tools: { jira: jiraTool, slack: slackTool },
    model: 'gpt-4',
  });

  const sessionId = `ops-demo-${Date.now()}`;

  // First request
  console.log('📋 Request: Create a Jira ticket and post to Slack...\n');
  const result = await runOpsAgent(runtime, {
    input:
      'Create a Jira ticket in PROJ with summary "Database connection pool exhaustion in prod" and description "Investigating high latency. Runbooks: check connection limits." Then post "Incident PROJ-xxx created for DB pool issue" to #incidents.',
    sessionId,
  });

  console.log('Response:', result.response);
  console.log(`\nCompleted in ${result.steps} steps (${result.duration}ms)`);
  console.log(
    '\nNote: Without JIRA_* and SLACK_BOT_TOKEN, placeholder responses are returned. Set env vars for real integration.'
  );
}

main().catch(console.error);
