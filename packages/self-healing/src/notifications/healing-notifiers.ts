import { HealingNotifier, HealingNotifyEvent } from '../types';

export interface SlackHealingNotifierConfig {
  token?: string;
  channel: string;
  username?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createSlackHealingNotifier(config: SlackHealingNotifierConfig): HealingNotifier {
  const token = config.token ?? process.env.SLACK_BOT_TOKEN ?? '';
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10000;

  return {
    async notify(event: HealingNotifyEvent, payload: Record<string, unknown>): Promise<void> {
      if (!token) {
        return;
      }

      const text = formatSlackMessage(event, payload);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        await fetchImpl('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            channel: config.channel,
            text,
            username: config.username ?? 'HazelJS Self-Healing',
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function formatSlackMessage(event: HealingNotifyEvent, payload: Record<string, unknown>): string {
  const target = String(payload.target ?? 'unknown');
  const strategy = payload.strategy ? ` strategy=${String(payload.strategy)}` : '';
  return `*[${event}]* ${target}${strategy}`;
}

export interface PagerDutyHealingNotifierConfig {
  routingKey?: string;
  source?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createPagerDutyHealingNotifier(
  config: PagerDutyHealingNotifierConfig
): HealingNotifier {
  const routingKey = config.routingKey ?? process.env.PAGERDUTY_ROUTING_KEY ?? '';
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 10000;

  return {
    async notify(event: HealingNotifyEvent, payload: Record<string, unknown>): Promise<void> {
      if (!routingKey) {
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        await fetchImpl('https://events.pagerduty.com/v2/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routing_key: routingKey,
            event_action: event === 'healing-failed' ? 'trigger' : 'trigger',
            payload: {
              summary: `[${event}] ${String(payload.target ?? 'self-healing')}`,
              severity: event === 'healing-failed' ? 'error' : 'warning',
              source: config.source ?? 'hazeljs-self-healing',
              custom_details: payload,
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createHealingNotifierChain(notifiers: HealingNotifier[]): HealingNotifier {
  return {
    async notify(event: HealingNotifyEvent, payload: Record<string, unknown>): Promise<void> {
      await Promise.all(
        notifiers.map((notifier) => notifier.notify(event, payload).catch(() => undefined))
      );
    },
  };
}
