/**
 * Slack tool adapter - post messages to channels and threads.
 * Uses Slack Web API (chat.postMessage).
 * Requires: SLACK_BOT_TOKEN env var (or pass via config).
 */

import type { SlackToolLike } from '../types';

export interface SlackConfig {
  /** Bot token (xoxb-...) from Slack app OAuth */
  token: string;
  /** Optional timeout in ms */
  timeoutMs?: number;
}

const SLACK_API = 'https://slack.com/api';

async function slackFetch(
  path: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SLACK_API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Create a Slack tool from config.
 * Env var: SLACK_BOT_TOKEN (used when config not provided).
 */
export function createSlackTool(config?: Partial<SlackConfig>): SlackToolLike {
  const token = config?.token ?? process.env.SLACK_BOT_TOKEN ?? '';
  const timeoutMs = config?.timeoutMs ?? 10000;

  if (!token) {
    return createPlaceholderSlackTool();
  }

  return {
    async postToChannel(input): Promise<{ ts: string; channel: string }> {
      const body: Record<string, unknown> = {
        channel: input.channel,
        text: input.text,
      };
      if (input.threadTs) {
        body.thread_ts = input.threadTs;
      }

      const res = await slackFetch('/chat.postMessage', token, body, timeoutMs);

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Slack post failed: ${res.status} ${err}`);
      }

      const data = (await res.json()) as {
        ok: boolean;
        ts?: string;
        channel?: string;
        error?: string;
      };
      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error ?? 'unknown'}`);
      }

      return { ts: data.ts ?? '', channel: data.channel ?? input.channel };
    },
  };
}

/** Placeholder when Slack token is not configured */
function createPlaceholderSlackTool(): SlackToolLike {
  return {
    async postToChannel(input): Promise<{ ts: string; channel: string }> {
      return { ts: `ts-${Date.now()}`, channel: input.channel };
    },
  };
}
