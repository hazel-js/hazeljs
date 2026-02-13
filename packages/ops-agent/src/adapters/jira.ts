/**
 * Jira tool adapter - create tickets, add comments, get ticket details.
 * Uses Jira Cloud REST API v3.
 * Requires: JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN env vars (or pass via config).
 */

import type { JiraToolLike } from '../types';

export interface JiraConfig {
  /** Jira host (e.g. https://your-domain.atlassian.net) */
  host: string;
  /** Email for Basic auth */
  email: string;
  /** API token from https://id.atlassian.com/manage-profile/security/api-tokens */
  apiToken: string;
  /** Optional timeout in ms */
  timeoutMs?: number;
}

function getAuthHeader(email: string, apiToken: string): string {
  const token = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return `Basic ${token}`;
}

async function jiraFetch(
  host: string,
  path: string,
  auth: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const url = `${host.replace(/\/$/, '')}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        ...(options.headers as Record<string, string>),
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create a Jira tool from config.
 * Env vars: JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN (used when config not provided).
 */
export function createJiraTool(config?: Partial<JiraConfig>): JiraToolLike {
  const host = config?.host ?? process.env.JIRA_HOST ?? '';
  const email = config?.email ?? process.env.JIRA_EMAIL ?? '';
  const apiToken = config?.apiToken ?? process.env.JIRA_API_TOKEN ?? '';
  const timeoutMs = config?.timeoutMs ?? 15000;

  if (!host || !email || !apiToken) {
    return createPlaceholderJiraTool();
  }

  const auth = getAuthHeader(email, apiToken);

  return {
    async createTicket(input): Promise<{ key: string; id: string; url?: string }> {
      const res = await jiraFetch(
        host,
        '/rest/api/3/issue',
        auth,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              project: { key: input.project },
              summary: input.summary,
              description: input.description
                ? {
                    type: 'doc',
                    version: 1,
                    content: [
                      { type: 'paragraph', content: [{ type: 'text', text: input.description }] },
                    ],
                  }
                : undefined,
              issuetype: { name: input.issueType ?? 'Task' },
              labels: input.labels ?? [],
            },
          }),
        },
        timeoutMs
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Jira create issue failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as { key: string; id: string };
      const browseUrl = `${host}/browse/${data.key}`;
      return { key: data.key, id: data.id, url: browseUrl };
    },

    async addComment(input): Promise<{ id: string }> {
      const res = await jiraFetch(
        host,
        `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}/comment`,
        auth,
        {
          method: 'POST',
          body: JSON.stringify({
            body: {
              type: 'doc',
              version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: input.body }] }],
            },
          }),
        },
        timeoutMs
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Jira add comment failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },

    async getTicket(input): Promise<{
      key: string;
      summary: string;
      status?: string;
      description?: string;
      url?: string;
    }> {
      const res = await jiraFetch(
        host,
        `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}?fields=summary,status,description`,
        auth,
        { method: 'GET' },
        timeoutMs
      );

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Jira issue not found: ${input.issueKey}`);
        }
        const err = await res.text();
        throw new Error(`Jira get issue failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as {
        key: string;
        fields: {
          summary?: string;
          status?: { name?: string };
          description?: { content?: Array<{ content?: Array<{ text?: string }> }> };
        };
      };
      const desc = data.fields?.description?.content?.[0]?.content?.[0]?.text;
      const browseUrl = `${host}/browse/${data.key}`;
      return {
        key: data.key,
        summary: data.fields?.summary ?? '',
        status: data.fields?.status?.name,
        description: desc,
        url: browseUrl,
      };
    },
  };
}

/** Placeholder when Jira credentials are not configured */
function createPlaceholderJiraTool(): JiraToolLike {
  return {
    async createTicket(input): Promise<{ key: string; id: string; url?: string }> {
      const key = `${input.project}-${Date.now()}`;
      return {
        key,
        id: key,
        url: `https://example.atlassian.net/browse/${key}`,
      };
    },
    async addComment(_input: { issueKey: string; body: string }): Promise<{ id: string }> {
      return { id: `comment-${Date.now()}` };
    },
    async getTicket(input: { issueKey: string }): Promise<{
      key: string;
      summary: string;
      status?: string;
      description?: string;
      url?: string;
    }> {
      return {
        key: input.issueKey,
        summary: 'Placeholder - configure JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN for real data',
        status: 'Unknown',
      };
    },
  };
}
