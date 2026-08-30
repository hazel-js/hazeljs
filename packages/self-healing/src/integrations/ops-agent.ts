import { HealingNotifyEvent, HealingNotifier } from '../types';

export interface JiraToolLike {
  createTicket(input: {
    project: string;
    summary: string;
    description?: string;
    issueType?: string;
    labels?: string[];
  }): Promise<{ key: string; id: string; url?: string }>;
}

export interface JiraHealingNotifierConfig {
  jira: JiraToolLike;
  project: string;
  issueType?: string;
  labels?: string[];
  events?: HealingNotifyEvent[];
}

/**
 * Create Jira incidents when healing events occur (e.g. healing-failed).
 * Compatible with createJiraTool() from @hazeljs/ops-agent.
 */
export function createJiraHealingNotifier(config: JiraHealingNotifierConfig): HealingNotifier {
  const events = config.events ?? ['healing-failed'];

  return {
    async notify(event: HealingNotifyEvent, payload: Record<string, unknown>): Promise<void> {
      if (!events.includes(event)) {
        return;
      }

      const target = String(payload.target ?? 'unknown');
      const diagnosis = payload.diagnosis as { message?: string; category?: string } | undefined;

      await config.jira.createTicket({
        project: config.project,
        issueType: config.issueType ?? 'Task',
        labels: [...(config.labels ?? []), 'hazeljs-self-healing', event],
        summary: `[Self-Healing ${event}] ${target}`,
        description: [
          `Event: ${event}`,
          `Target: ${target}`,
          diagnosis?.category ? `Category: ${diagnosis.category}` : undefined,
          diagnosis?.message ? `Diagnosis: ${diagnosis.message}` : undefined,
          '',
          'Payload:',
          '```',
          JSON.stringify(payload, null, 2),
          '```',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    },
  };
}
