/**
 * Extensible agent trigger contract (schedule now; webhook/event stubs).
 */

export type AgentTrigger =
  | { type: 'schedule'; cron: string }
  | { type: 'webhook'; path?: string }
  | { type: 'event'; topic: string };

export interface TriggerHandler {
  kind: AgentTrigger['type'];
  /** Register trigger for an agent; returns unsubscribe. */
  register(agentId: string, trigger: AgentTrigger): Promise<() => void>;
}

export class ScheduleTriggerHandler implements TriggerHandler {
  readonly kind = 'schedule' as const;

  constructor(
    private readonly schedule: (agentId: string, cron: string) => Promise<() => void>
  ) {}

  async register(agentId: string, trigger: AgentTrigger): Promise<() => void> {
    if (trigger.type !== 'schedule') {
      throw new Error('ScheduleTriggerHandler only accepts schedule triggers');
    }
    return this.schedule(agentId, trigger.cron);
  }
}

/** Stub — reserved for future webhook ingress on the local node. */
export class WebhookTriggerHandler implements TriggerHandler {
  readonly kind = 'webhook' as const;
  async register(): Promise<() => void> {
    return () => undefined;
  }
}

/** Stub — reserved for future event-bus triggers. */
export class EventTriggerHandler implements TriggerHandler {
  readonly kind = 'event' as const;
  async register(): Promise<() => void> {
    return () => undefined;
  }
}
