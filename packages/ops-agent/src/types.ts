/**
 * Ops agent tool interfaces.
 * Implement these or use the built-in Jira and Slack adapters.
 */

export interface JiraToolLike {
  createTicket(input: {
    project: string;
    summary: string;
    description?: string;
    issueType?: string;
    labels?: string[];
  }): Promise<{ key: string; id: string; url?: string }>;
  addComment(input: { issueKey: string; body: string }): Promise<{ id: string }>;
  getTicket(input: { issueKey: string }): Promise<{
    key: string;
    summary: string;
    status?: string;
    description?: string;
    url?: string;
  }>;
}

export interface SlackToolLike {
  postToChannel(input: {
    channel: string;
    text: string;
    threadTs?: string;
  }): Promise<{ ts: string; channel: string }>;
}

export interface OpsAgentToolsConfig {
  jira: JiraToolLike;
  slack: SlackToolLike;
}

/** AI service for LLM - e.g. AIEnhancedService from @hazeljs/ai */
export type AIServiceAdapter = import('@hazeljs/agent').AIServiceAdapter;

export interface CreateOpsRuntimeOptions {
  /** AI service for LLM (e.g. AIEnhancedService from @hazeljs/ai) */
  aiService: AIServiceAdapter;
  /** Tool implementations - use createJiraTool, createSlackTool or your own */
  tools: OpsAgentToolsConfig;
  /** Default model for the ops agent (e.g. gpt-4, claude-3-sonnet) */
  model?: string;
  /** RAG service for runbooks / docs search (optional) */
  ragService?: unknown;
  /** Memory manager for conversation history (optional) */
  memoryManager?: unknown;
}
